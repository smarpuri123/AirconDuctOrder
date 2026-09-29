import type { DispatchStatus } from '@/types'

/** Left-to-right lifecycle for dispatch trip kanban */
export const DISPATCH_STATUS_FLOW: DispatchStatus[] = [
  'draft',
  'loading',
  'loaded',
  'dispatched',
  'delivered',
]

export const DISPATCH_KANBAN_COLUMNS: { id: DispatchStatus; title: string }[] = [
  { id: 'draft', title: 'Draft' },
  { id: 'loading', title: 'Loading' },
  { id: 'loaded', title: 'Loaded' },
  { id: 'dispatched', title: 'Dispatched' },
  { id: 'delivered', title: 'Delivered' },
]

const VALID_STATUSES = new Set<string>(DISPATCH_STATUS_FLOW)

export function normalizeDispatchStatus(status: string): DispatchStatus {
  const normalized = status.toLowerCase().replace(/-/g, '_')
  if (VALID_STATUSES.has(normalized)) {
    return normalized as DispatchStatus
  }
  return 'dispatched'
}

export function getDispatchStatusTitle(status: DispatchStatus): string {
  return DISPATCH_KANBAN_COLUMNS.find((c) => c.id === status)?.title ?? status
}

export function getDispatchFlowIndex(status: DispatchStatus): number {
  return DISPATCH_STATUS_FLOW.indexOf(status)
}

/** Next stage in the lifecycle, or null if at delivered (or unknown). */
export function getNextDispatchStatus(current: DispatchStatus): DispatchStatus | null {
  const idx = getDispatchFlowIndex(current)
  if (idx < 0 || idx >= DISPATCH_STATUS_FLOW.length - 1) return null
  return DISPATCH_STATUS_FLOW[idx + 1]
}

export function isDispatchStatusCompleted(current: DispatchStatus, step: DispatchStatus): boolean {
  const cur = getDispatchFlowIndex(current)
  const stepIdx = getDispatchFlowIndex(step)
  if (cur < 0 || stepIdx < 0) return false
  return stepIdx < cur
}

/** Only the immediate next stage may be selected (no skipping or going backward). */
export function canTransitionDispatchTo(current: DispatchStatus, target: DispatchStatus): boolean {
  return getNextDispatchStatus(current) === target
}

/** Status progression actions (mobile / ops); draft is created only before trip confirmation */
export const DISPATCH_STATUS_ACTIONS: { status: DispatchStatus; label: string }[] = [
  { status: 'loading', label: 'Mark loading' },
  { status: 'loaded', label: 'Mark loaded' },
  { status: 'dispatched', label: 'Mark dispatched' },
  { status: 'delivered', label: 'Mark delivered' },
]
