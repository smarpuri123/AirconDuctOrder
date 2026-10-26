import { prisma } from '../lib/prisma.js'
import { Prisma } from '@prisma/client'
import {
  canRevertOrderStep,
  describeOrderRevertTarget,
  isOrderFullyDelivered,
  orderHasDispatches,
} from '../lib/order-workflow.js'
import {
  resetProductionTrackFields,
  transitionProductionTrack,
} from './production-track.service.js'

export async function listCustomerOrders(filters?: { status?: string; search?: string }) {
  const where: Prisma.CustomerOrderWhereInput = {}

  if (filters?.status) {
    where.status = filters.status.toUpperCase()
  }

  if (filters?.search) {
    where.OR = [
      { orderNo: { contains: filters.search, mode: 'insensitive' } },
      { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
    ]
  }

  return prisma.customerOrder.findMany({
    where,
    include: {
      customer: true,
      project: true,
      items: true,
      dispatches: { select: { id: true, dispatchNo: true, totalQuantity: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getCustomerOrderById(id: string) {
  return prisma.customerOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      project: true,
      quotation: true,
      customerPo: true,
      ductSchedule: true,
      items: { orderBy: { tagNo: 'asc' } },
      dispatches: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
      manufacturingOrders: true,
    },
  })
}

export function computeOrderBalances<T extends { orderedQty: number; dispatchedQty: number; readyQty: number }>(
  items: T[],
) {
  const totalOrdered = items.reduce((s, i) => s + i.orderedQty, 0)
  const totalDispatched = items.reduce((s, i) => s + i.dispatchedQty, 0)
  const totalReady = items.reduce((s, i) => s + i.readyQty, 0)
  return {
    totalOrdered,
    totalDispatched,
    balanceQty: totalOrdered - totalDispatched,
    totalReady,
    availableToDispatch: items.reduce(
      (s, i) => s + Math.min(i.readyQty - i.dispatchedQty, i.orderedQty - i.dispatchedQty),
      0,
    ),
  }
}

async function logOrderActivity(orderId: string, input: {
  phase: string
  title: string
  detail?: string
  actor: string
  actorRole?: string
  revision?: number
  metadata?: Prisma.InputJsonValue
}) {
  const enquiry = await prisma.enquiry.findFirst({ where: { customerOrderId: orderId } })
  if (!enquiry) return
  await prisma.enquiryActivity.create({
    data: { enquiryId: enquiry.id, ...input },
  })
}

export async function approveProductionStart(orderId: string, actor: { name: string; role: string }) {
  const updated = await prisma.customerOrder.updateMany({
    where: { id: orderId, productionApproved: false },
    data: {
      productionApproved: true,
      productionApprovedBy: actor.name,
      productionApprovedDate: new Date(),
    },
  })
  if (updated.count === 0) return getCustomerOrderById(orderId)

  await logOrderActivity(orderId, {
    phase: 'production',
    title: 'Production start approved',
    detail: `${actor.name} approved shop floor to begin fabrication`,
    actor: actor.name,
    actorRole: actor.role,
  })

  return getCustomerOrderById(orderId)
}

export async function completeProductionProcess(
  orderId: string,
  process: 'straight_ducts' | 'plasma_ducts',
  actor: { name: string; role: string },
) {
  const order = await transitionProductionTrack(orderId, process, 'complete', actor)
  return order ? getCustomerOrderById(orderId) : null
}

export async function updateProductionTrack(
  orderId: string,
  process: 'straight_ducts' | 'plasma_ducts',
  action: 'start' | 'pause' | 'resume' | 'complete',
  actor: { name: string; role: string },
  note?: string,
) {
  const order = await transitionProductionTrack(orderId, process, action, actor, note)
  return order ? getCustomerOrderById(orderId) : null
}

export async function markProductionReady(orderId: string, actor: { name: string; role: string }) {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return null

  if (!order.straightDuctsCompleted || !order.plasmaDuctsCompleted) {
    throw new Error('Complete Straight Ducts and Plasma Ducts production before marking ready')
  }

  await prisma.$transaction([
    ...order.items.map((item) =>
      prisma.customerOrderItem.update({
        where: { id: item.id },
        data: { producedQty: item.orderedQty, readyQty: item.orderedQty },
      }),
    ),
    prisma.customerOrder.update({
      where: { id: orderId },
      data: { status: 'READY' },
    }),
  ])

  await logOrderActivity(orderId, {
    phase: 'production',
    title: 'Marked ready for dispatch',
    detail: 'All production processes complete — stock ready for dispatch',
    actor: actor.name,
    actorRole: actor.role,
  })

  return getCustomerOrderById(orderId)
}

export async function revertOrderWorkflowStep(
  orderId: string,
  reason: string,
  actor: { name: string; role: string },
) {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return null
  const floorEngaged =
    order.productionApproved ||
    order.straightDuctsStatus !== 'NOT_STARTED' ||
    order.plasmaDuctsStatus !== 'NOT_STARTED'
  if (!canRevertOrderStep(order.status, order.items, floorEngaged)) return null

  const detail =
    reason.trim() || describeOrderRevertTarget(order.status, floorEngaged)

  if (order.status === 'READY') {
    await prisma.$transaction([
      ...order.items.map((item) =>
        prisma.customerOrderItem.update({
          where: { id: item.id },
          data: { producedQty: 0, readyQty: 0 },
        }),
      ),
      prisma.customerOrder.update({
        where: { id: orderId },
        data: {
          status: 'IN_PRODUCTION',
          ...resetProductionTrackFields(),
        },
      }),
    ])
  } else if (order.status === 'IN_PRODUCTION' && floorEngaged) {
    await prisma.customerOrder.update({
      where: { id: orderId },
      data: resetProductionTrackFields(),
    })
  } else if (order.status === 'IN_PRODUCTION') {
    await prisma.$transaction([
      ...order.items.map((item) =>
        prisma.customerOrderItem.update({
          where: { id: item.id },
          data: { producedQty: 0, readyQty: 0 },
        }),
      ),
      prisma.customerOrder.update({
        where: { id: orderId },
        data: resetProductionTrackFields(),
      }),
    ])
  } else {
    return null
  }

  await logOrderActivity(orderId, {
    phase: 'production',
    title: 'Workflow step back',
    detail,
    actor: actor.name,
    actorRole: actor.role,
  })

  return getCustomerOrderById(orderId)
}
