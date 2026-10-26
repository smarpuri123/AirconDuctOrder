import type { Order } from '@/types'
import type { ProductionProcess } from '@/types/production'

export type ProductionTrackStatus = 'not_started' | 'running' | 'paused' | 'completed'
export type ProductionTrackAction = 'start' | 'pause' | 'resume' | 'complete'

export const PRODUCTION_TRACK_STATUSES: ProductionTrackStatus[] = [
  'not_started',
  'running',
  'paused',
  'completed',
]

const DB_STATUS: Record<string, ProductionTrackStatus> = {
  NOT_STARTED: 'not_started',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
}

const TO_DB: Record<ProductionTrackStatus, string> = {
  not_started: 'NOT_STARTED',
  running: 'RUNNING',
  paused: 'PAUSED',
  completed: 'COMPLETED',
}

export function productionTrackStatusToDb(status: ProductionTrackStatus): string {
  return TO_DB[status]
}

export function productionTrackStatusFromDb(
  value: string | null | undefined,
  completed: boolean,
): ProductionTrackStatus {
  if (completed) return 'completed'
  if (!value) return 'not_started'
  return DB_STATUS[value] ?? 'not_started'
}

type TrackFields = {
  straightDuctsCompleted?: boolean
  straightDuctsStatus?: ProductionTrackStatus
  straightDuctsActiveSeconds?: number
  straightDuctsRunStartedAt?: string
  plasmaDuctsCompleted?: boolean
  plasmaDuctsStatus?: ProductionTrackStatus
  plasmaDuctsActiveSeconds?: number
  plasmaDuctsRunStartedAt?: string
}

export function getProductionTrackStatus(
  order: TrackFields,
  process: ProductionProcess,
): ProductionTrackStatus {
  if (process === 'straight_ducts') {
    return (
      order.straightDuctsStatus ??
      productionTrackStatusFromDb(undefined, Boolean(order.straightDuctsCompleted))
    )
  }
  return (
    order.plasmaDuctsStatus ??
    productionTrackStatusFromDb(undefined, Boolean(order.plasmaDuctsCompleted))
  )
}

export function getProductionTrackActiveSeconds(
  order: TrackFields,
  process: ProductionProcess,
  at: Date = new Date(),
): number {
  const base =
    process === 'straight_ducts'
      ? order.straightDuctsActiveSeconds ?? 0
      : order.plasmaDuctsActiveSeconds ?? 0
  const status = getProductionTrackStatus(order, process)
  if (status !== 'running') return base
  const startedAt =
    process === 'straight_ducts' ? order.straightDuctsRunStartedAt : order.plasmaDuctsRunStartedAt
  if (!startedAt) return base
  const t = new Date(startedAt).getTime()
  if (Number.isNaN(t)) return base
  return base + Math.max(0, Math.floor((at.getTime() - t) / 1000))
}

export function formatProductionActiveTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function productionTrackStarted(order: Order, process: ProductionProcess): boolean {
  const status = getProductionTrackStatus(order, process)
  return status !== 'not_started'
}

export function productionFloorEngaged(order: Order): boolean {
  return (
    Boolean(order.productionApproved) ||
    productionTrackStarted(order, 'straight_ducts') ||
    productionTrackStarted(order, 'plasma_ducts')
  )
}

export function productionTracksNeedingWork(order: Order): boolean {
  if (order.status !== 'production') return false
  const straight = getProductionTrackStatus(order, 'straight_ducts')
  const plasma = getProductionTrackStatus(order, 'plasma_ducts')
  const open = (s: ProductionTrackStatus) => s !== 'completed'
  return open(straight) || open(plasma)
}

export function productionAwaitingFloorStart(order: Order): boolean {
  if (order.status !== 'production') return false
  const straight = getProductionTrackStatus(order, 'straight_ducts')
  const plasma = getProductionTrackStatus(order, 'plasma_ducts')
  return straight === 'not_started' && plasma === 'not_started'
}

export const PRODUCTION_TRACK_STATUS_LABELS: Record<ProductionTrackStatus, string> = {
  not_started: 'Not started',
  running: 'In progress',
  paused: 'Paused',
  completed: 'Complete',
}
