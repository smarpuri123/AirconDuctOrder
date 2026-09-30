import { prisma } from '../lib/prisma.js'
import { Prisma } from '@prisma/client'
import {
  allocateSequence,
  ensureSequenceAtLeast,
  maxDispatchSequenceFromNumbers,
} from '../lib/business-sequence.js'
import { incrementDispatchedQtyIfAvailable } from '../lib/dispatch-inventory.js'
import { runTransactionWithRetry } from '../lib/transaction-retry.js'

interface CreateDispatchInput {
  customerOrderId: string
  createdById: string
  vehicle: {
    vehicleNumber: string
    driverName: string
    driverMobile: string
    transporter: string
    vehicleType: string
    loadingDate: string
    loadingTime: string
    lrNumber?: string
    ewayBillNumber?: string
    destination?: string
    remarks?: string
  }
  items: Array<{ customerOrderItemId: string; quantity: number }>
}

export async function createDispatch(input: CreateDispatchInput) {
  return runTransactionWithRetry(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM customer_orders WHERE id = ${input.customerOrderId} FOR UPDATE
    `

    const order = await tx.customerOrder.findUnique({
      where: { id: input.customerOrderId },
      include: { items: true },
    })
    if (!order) throw new Error('Customer order not found')

    const dispatchItems: Array<{
      customerOrderItemId: string
      quantity: number
      area: Prisma.Decimal
    }> = []

    for (const item of input.items) {
      if (item.quantity <= 0) continue

      const orderItem = order.items.find((i) => i.id === item.customerOrderItemId)
      if (!orderItem) throw new Error(`Order item not found: ${item.customerOrderItemId}`)

      const available = Math.min(
        orderItem.readyQty - orderItem.dispatchedQty,
        orderItem.orderedQty - orderItem.dispatchedQty,
      )
      if (item.quantity > available) {
        throw new Error(
          `Cannot dispatch ${item.quantity} for tag ${orderItem.tagNo}. Only ${available} available.`,
        )
      }

      const unitArea = orderItem.orderedQty > 0
        ? Number(orderItem.area) / orderItem.orderedQty
        : 0

      dispatchItems.push({
        customerOrderItemId: item.customerOrderItemId,
        quantity: item.quantity,
        area: new Prisma.Decimal(unitArea * item.quantity),
      })
    }

    if (dispatchItems.length === 0) throw new Error('No items selected for dispatch')

    const year = new Date().getFullYear()
    const scope = `dispatch:${year}`
    const existingNos = await tx.dispatch.findMany({
      where: { dispatchNo: { startsWith: `D-${year}-` } },
      select: { dispatchNo: true },
    })
    const lastUsed = maxDispatchSequenceFromNumbers(existingNos.map((r) => r.dispatchNo), year)
    await ensureSequenceAtLeast(tx, scope, lastUsed)
    const seq = await allocateSequence(tx, scope)
    const dispatchNo = `D-${year}-${String(seq).padStart(4, '0')}`

    const totalQuantity = dispatchItems.reduce((s, i) => s + i.quantity, 0)
    const totalArea = dispatchItems.reduce((s, i) => s + Number(i.area), 0)

    let vehicle = await tx.vehicle.findUnique({
      where: { vehicleNumber: input.vehicle.vehicleNumber },
    })
    if (!vehicle) {
      vehicle = await tx.vehicle.create({
        data: {
          vehicleNumber: input.vehicle.vehicleNumber,
          vehicleType: input.vehicle.vehicleType,
          transporter: input.vehicle.transporter,
        },
      })
    }

    const dispatch = await tx.dispatch.create({
      data: {
        dispatchNo,
        customerOrderId: input.customerOrderId,
        vehicleId: vehicle.id,
        driverName: input.vehicle.driverName,
        driverMobile: input.vehicle.driverMobile,
        transporter: input.vehicle.transporter,
        vehicleType: input.vehicle.vehicleType,
        vehicleNumber: input.vehicle.vehicleNumber,
        loadingDate: new Date(input.vehicle.loadingDate),
        loadingTime: input.vehicle.loadingTime,
        lrNumber: input.vehicle.lrNumber,
        ewayBillNumber: input.vehicle.ewayBillNumber,
        destination: input.vehicle.destination,
        remarks: input.vehicle.remarks,
        totalQuantity,
        totalArea,
        status: 'LOADING',
        dispatchDate: new Date(input.vehicle.loadingDate),
        createdById: input.createdById,
        items: {
          create: dispatchItems,
        },
      },
      include: { items: { include: { customerOrderItem: true } }, customerOrder: { include: { customer: true } } },
    })

    for (const di of dispatchItems) {
      const ok = await incrementDispatchedQtyIfAvailable(tx, di.customerOrderItemId, di.quantity)
      if (!ok) {
        const orderItem = order.items.find((i) => i.id === di.customerOrderItemId)
        throw new Error(
          `Cannot dispatch ${di.quantity} for tag ${orderItem?.tagNo ?? '?'}. Quantity changed concurrently — refresh and retry.`,
        )
      }
    }

    const updatedItems = await tx.customerOrderItem.findMany({
      where: { customerOrderId: input.customerOrderId },
    })
    const allDispatched = updatedItems.every((i) => i.dispatchedQty >= i.orderedQty)
    const anyDispatched = updatedItems.some((i) => i.dispatchedQty > 0)

    await tx.customerOrder.update({
      where: { id: input.customerOrderId },
      data: {
        status: allDispatched ? 'FULLY_DISPATCHED' : anyDispatched ? 'PARTIALLY_DISPATCHED' : order.status,
      },
    })

    const tripCount = await tx.dispatch.count({ where: { customerOrderId: input.customerOrderId } })
    const enquiry = await tx.enquiry.findFirst({ where: { customerOrderId: input.customerOrderId } })
    if (enquiry) {
      const creator = await tx.user.findUnique({ where: { id: input.createdById } })
      await tx.enquiryActivity.create({
        data: {
          enquiryId: enquiry.id,
          phase: 'dispatch',
          title: `Dispatch Trip ${tripCount} created`,
          detail: `${dispatchNo} · ${totalQuantity} qty · ${input.vehicle.vehicleNumber}`,
          actor: creator?.name ?? 'Dispatch User',
          actorRole: 'Dispatch',
          revision: tripCount,
        },
      })
      if (allDispatched) {
        await tx.enquiryActivity.create({
          data: {
            enquiryId: enquiry.id,
            phase: 'dispatch',
            title: 'Delivery completed',
            detail: 'All quantities dispatched — order closed',
            actor: creator?.name ?? 'Dispatch User',
            actorRole: 'Dispatch',
          },
        })
      }
    }

    return dispatch
  })
}

export async function listDispatches() {
  return prisma.dispatch.findMany({
    include: {
      customerOrder: { include: { customer: true } },
      items: { include: { customerOrderItem: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getDispatchById(id: string) {
  return prisma.dispatch.findUnique({
    where: { id },
    include: {
      customerOrder: { include: { customer: true, items: true } },
      items: { include: { customerOrderItem: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })
}

const DISPATCH_STATUSES = ['DRAFT', 'LOADING', 'LOADED', 'DISPATCHED', 'DELIVERED'] as const

export async function updateDispatchStatus(id: string, status: string) {
  const normalized = status.toUpperCase().replace(/-/g, '_')
  if (!DISPATCH_STATUSES.includes(normalized as typeof DISPATCH_STATUSES[number])) {
    throw new Error('Invalid dispatch status')
  }

  const existing = await prisma.dispatch.findUnique({ where: { id } })
  if (!existing) throw new Error('Dispatch not found')

  const currentStatus = existing.status.toUpperCase().replace(/-/g, '_') as typeof DISPATCH_STATUSES[number]
  const currentIdx = DISPATCH_STATUSES.indexOf(currentStatus)
  const targetIdx = DISPATCH_STATUSES.indexOf(normalized as typeof DISPATCH_STATUSES[number])
  if (currentIdx < 0 || targetIdx !== currentIdx + 1) {
    throw new Error('Dispatch can only move forward to the next stage')
  }

  const updated = await prisma.dispatch.updateMany({
    where: { id, status: existing.status },
    data: { status: normalized },
  })
  if (updated.count !== 1) {
    throw new Error('Dispatch status was updated by another request — refresh and retry')
  }

  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      customerOrder: { include: { customer: true } },
      items: { include: { customerOrderItem: true } },
    },
  })
  if (!dispatch) throw new Error('Dispatch not found')
  return dispatch
}
