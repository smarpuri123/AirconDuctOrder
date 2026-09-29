import { prisma } from '../lib/prisma.js'
import { Prisma } from '@prisma/client'
import {
  canRevertOrderStep,
  describeOrderRevertTarget,
  isOrderFullyDelivered,
  orderHasDispatches,
} from '../lib/order-workflow.js'

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

const PROCESS_LABELS: Record<'straight_ducts' | 'plasma_ducts', string> = {
  straight_ducts: 'Straight Ducts',
  plasma_ducts: 'Plasma Ducts',
}

export async function completeProductionProcess(
  orderId: string,
  process: 'straight_ducts' | 'plasma_ducts',
  actor: { name: string; role: string },
) {
  const order = await prisma.customerOrder.findUnique({ where: { id: orderId } })
  if (!order) return null

  const now = new Date()
  const updated =
    process === 'straight_ducts'
      ? await prisma.customerOrder.updateMany({
          where: { id: orderId, straightDuctsCompleted: false },
          data: {
            straightDuctsCompleted: true,
            straightDuctsCompletedAt: now,
            straightDuctsCompletedBy: actor.name,
          },
        })
      : await prisma.customerOrder.updateMany({
          where: { id: orderId, plasmaDuctsCompleted: false },
          data: {
            plasmaDuctsCompleted: true,
            plasmaDuctsCompletedAt: now,
            plasmaDuctsCompletedBy: actor.name,
          },
        })

  if (updated.count === 0) return getCustomerOrderById(orderId)

  await logOrderActivity(orderId, {
    phase: 'production',
    title: `${PROCESS_LABELS[process]} — complete`,
    detail: `Marked by ${actor.name}`,
    actor: actor.name,
    actorRole: actor.role,
    metadata: { productionProcess: process },
  })

  return getCustomerOrderById(orderId)
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
  if (!canRevertOrderStep(order.status, order.items, order.productionApproved)) return null

  const detail =
    reason.trim() || describeOrderRevertTarget(order.status, order.productionApproved)

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
          straightDuctsCompleted: false,
          straightDuctsCompletedAt: null,
          straightDuctsCompletedBy: null,
          plasmaDuctsCompleted: false,
          plasmaDuctsCompletedAt: null,
          plasmaDuctsCompletedBy: null,
        },
      }),
    ])
  } else if (order.status === 'IN_PRODUCTION' && order.productionApproved) {
    await prisma.customerOrder.updateMany({
      where: { id: orderId, productionApproved: true },
      data: {
        productionApproved: false,
        productionApprovedBy: null,
        productionApprovedDate: null,
      },
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
        data: {
          straightDuctsCompleted: false,
          straightDuctsCompletedAt: null,
          straightDuctsCompletedBy: null,
          plasmaDuctsCompleted: false,
          plasmaDuctsCompletedAt: null,
          plasmaDuctsCompletedBy: null,
        },
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
