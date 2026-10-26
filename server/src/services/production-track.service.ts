import { prisma } from '../lib/prisma.js'
import type { Prisma } from '@prisma/client'

export type ProductionProcess = 'straight_ducts' | 'plasma_ducts'
export type ProductionTrackAction = 'start' | 'pause' | 'resume' | 'complete'

const PROCESS_LABELS: Record<ProductionProcess, string> = {
  straight_ducts: 'Straight Ducts',
  plasma_ducts: 'Plasma Ducts',
}

type Actor = { name: string; role: string }

type OrderTrackRow = {
  id: string
  status: string
  productionApproved: boolean
  straightDuctsStatus: string
  straightDuctsActiveSeconds: number
  straightDuctsRunStartedAt: Date | null
  straightDuctsCompleted: boolean
  straightDuctsCompletedAt: Date | null
  straightDuctsCompletedBy: string | null
  plasmaDuctsStatus: string
  plasmaDuctsActiveSeconds: number
  plasmaDuctsRunStartedAt: Date | null
  plasmaDuctsCompleted: boolean
  plasmaDuctsCompletedAt: Date | null
  plasmaDuctsCompletedBy: string | null
}

function processDbStatus(process: ProductionProcess, order: OrderTrackRow): string {
  return process === 'straight_ducts' ? order.straightDuctsStatus : order.plasmaDuctsStatus
}

function isCompleted(process: ProductionProcess, order: OrderTrackRow): boolean {
  return process === 'straight_ducts' ? order.straightDuctsCompleted : order.plasmaDuctsCompleted
}

async function logOrderActivity(
  orderId: string,
  input: {
    phase: string
    title: string
    detail?: string
    actor: string
    actorRole?: string
    metadata?: Prisma.InputJsonValue
  },
) {
  const enquiry = await prisma.enquiry.findFirst({ where: { customerOrderId: orderId } })
  if (!enquiry) return
  await prisma.enquiryActivity.create({
    data: { enquiryId: enquiry.id, ...input },
  })
}

function accumulateRunningSeconds(
  order: OrderTrackRow,
  process: ProductionProcess,
  now: Date,
): number {
  const base =
    process === 'straight_ducts'
      ? order.straightDuctsActiveSeconds
      : order.plasmaDuctsActiveSeconds
  const runStarted =
    process === 'straight_ducts' ? order.straightDuctsRunStartedAt : order.plasmaDuctsRunStartedAt
  if (processDbStatus(process, order) !== 'RUNNING' || !runStarted) return base
  return base + Math.max(0, Math.floor((now.getTime() - runStarted.getTime()) / 1000))
}

async function pauseOtherRunningOnWorkCenter(
  process: ProductionProcess,
  exceptOrderId: string,
  actor: Actor,
  reason: string,
) {
  const statusField =
    process === 'straight_ducts' ? { straightDuctsStatus: 'RUNNING' } : { plasmaDuctsStatus: 'RUNNING' }

  const others = await prisma.customerOrder.findMany({
    where: {
      status: 'IN_PRODUCTION',
      id: { not: exceptOrderId },
      ...statusField,
    },
  })

  for (const other of others) {
    await transitionProductionTrack(other.id, process, 'pause', actor, reason)
  }
}

function trackUpdateData(
  process: ProductionProcess,
  patch: Partial<{
    status: string
    activeSeconds: number
    runStartedAt: Date | null
    completed: boolean
    completedAt: Date | null
    completedBy: string | null
  }>,
): Prisma.CustomerOrderUpdateInput {
  const prefix = process === 'straight_ducts' ? 'straightDucts' : 'plasmaDucts'
  const out: Prisma.CustomerOrderUpdateInput = {}
  if (patch.status !== undefined) out[`${prefix}Status`] = patch.status
  if (patch.activeSeconds !== undefined) out[`${prefix}ActiveSeconds`] = patch.activeSeconds
  if (patch.runStartedAt !== undefined) out[`${prefix}RunStartedAt`] = patch.runStartedAt
  if (patch.completed !== undefined) out[`${prefix}Completed`] = patch.completed
  if (patch.completedAt !== undefined) out[`${prefix}CompletedAt`] = patch.completedAt
  if (patch.completedBy !== undefined) out[`${prefix}CompletedBy`] = patch.completedBy
  return out
}

export async function transitionProductionTrack(
  orderId: string,
  process: ProductionProcess,
  action: ProductionTrackAction,
  actor: Actor,
  detailNote?: string,
) {
  const order = await prisma.customerOrder.findUnique({ where: { id: orderId } })
  if (!order) return null
  if (order.status !== 'IN_PRODUCTION') {
    throw new Error('Order must be in production to update shop-floor tracks')
  }

  const label = PROCESS_LABELS[process]
  const now = new Date()
  const currentStatus = processDbStatus(process, order)

  if (isCompleted(process, order) || currentStatus === 'COMPLETED') {
    if (action === 'complete') return order
    throw new Error(`${label} is already complete`)
  }

  if (action === 'start') {
    if (currentStatus === 'RUNNING') return order
    if (currentStatus !== 'NOT_STARTED') {
      throw new Error(`Use resume to continue ${label}`)
    }
    await pauseOtherRunningOnWorkCenter(
      process,
      orderId,
      actor,
      `Auto-paused — ${label} started on ${order.orderNo}`,
    )
    await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        productionApproved: true,
        productionApprovedBy: order.productionApprovedBy ?? actor.name,
        productionApprovedDate: order.productionApprovedDate ?? now,
        ...trackUpdateData(process, {
          status: 'RUNNING',
          runStartedAt: now,
          activeSeconds:
            process === 'straight_ducts'
              ? order.straightDuctsActiveSeconds
              : order.plasmaDuctsActiveSeconds,
        }),
      },
    })
    await logOrderActivity(orderId, {
      phase: 'production',
      title: `${label} — started`,
      detail: detailNote ?? `Shop floor timer started by ${actor.name}`,
      actor: actor.name,
      actorRole: actor.role,
      metadata: { productionProcess: process, productionTrackAction: 'start' },
    })
    return prisma.customerOrder.findUnique({ where: { id: orderId } })
  }

  if (action === 'resume') {
    if (currentStatus === 'RUNNING') return order
    if (currentStatus !== 'PAUSED') {
      throw new Error(`Start ${label} before resuming`)
    }
    await pauseOtherRunningOnWorkCenter(
      process,
      orderId,
      actor,
      `Auto-paused — ${label} resumed on ${order.orderNo}`,
    )
    await prisma.customerOrder.update({
      where: { id: orderId },
      data: trackUpdateData(process, {
        status: 'RUNNING',
        runStartedAt: now,
        activeSeconds: accumulateRunningSeconds(order, process, now),
      }),
    })
    await logOrderActivity(orderId, {
      phase: 'production',
      title: `${label} — resumed`,
      detail: detailNote ?? `Resumed by ${actor.name}`,
      actor: actor.name,
      actorRole: actor.role,
      metadata: { productionProcess: process, productionTrackAction: 'resume' },
    })
    return prisma.customerOrder.findUnique({ where: { id: orderId } })
  }

  if (action === 'pause') {
    if (currentStatus !== 'RUNNING') {
      throw new Error(`${label} is not running`)
    }
    const activeSeconds = accumulateRunningSeconds(order, process, now)
    await prisma.customerOrder.update({
      where: { id: orderId },
      data: trackUpdateData(process, {
        status: 'PAUSED',
        activeSeconds,
        runStartedAt: null,
      }),
    })
    await logOrderActivity(orderId, {
      phase: 'production',
      title: `${label} — paused`,
      detail:
        detailNote ??
        `Paused by ${actor.name} · active time ${Math.floor(activeSeconds / 60)} min`,
      actor: actor.name,
      actorRole: actor.role,
      metadata: { productionProcess: process, productionTrackAction: 'pause', activeSeconds },
    })
    return prisma.customerOrder.findUnique({ where: { id: orderId } })
  }

  if (action === 'complete') {
    const activeSeconds = accumulateRunningSeconds(order, process, now)
    await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        ...trackUpdateData(process, {
          status: 'COMPLETED',
          activeSeconds,
          runStartedAt: null,
          completed: true,
          completedAt: now,
          completedBy: actor.name,
        }),
      },
    })
    await logOrderActivity(orderId, {
      phase: 'production',
      title: `${label} — complete`,
      detail: `Marked by ${actor.name} · active time ${formatMinutes(activeSeconds)}`,
      actor: actor.name,
      actorRole: actor.role,
      metadata: { productionProcess: process, productionTrackAction: 'complete', activeSeconds },
    })
    return prisma.customerOrder.findUnique({ where: { id: orderId } })
  }

  throw new Error('Unknown production track action')
}

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export function resetProductionTrackFields(): Prisma.CustomerOrderUpdateInput {
  return {
    productionApproved: false,
    productionApprovedBy: null,
    productionApprovedDate: null,
    straightDuctsStatus: 'NOT_STARTED',
    straightDuctsActiveSeconds: 0,
    straightDuctsRunStartedAt: null,
    straightDuctsCompleted: false,
    straightDuctsCompletedAt: null,
    straightDuctsCompletedBy: null,
    plasmaDuctsStatus: 'NOT_STARTED',
    plasmaDuctsActiveSeconds: 0,
    plasmaDuctsRunStartedAt: null,
    plasmaDuctsCompleted: false,
    plasmaDuctsCompletedAt: null,
    plasmaDuctsCompletedBy: null,
  }
}
