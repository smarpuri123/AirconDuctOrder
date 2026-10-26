import type { Enquiry } from '@/types/enquiry'
import type { Dispatch, Order } from '@/types'
import { getOrderDispatchedQty } from '@/lib/calculations'
import { resolveWorkflowDisplayStage } from '@/lib/operationsWorkflow'
import { isApprovalProcessing } from '@/lib/enquiryWorkflow'
import type { FlowColumnId, FlowProductionTrack } from './types'

const PRIORITY_RANK: Record<Enquiry['priority'], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

export function compareEnquiryPriority(a: Enquiry['priority'], b: Enquiry['priority']): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b]
}

export function formatDispatchProgress(dispatchedQty: number, totalQty: number): string {
  if (totalQty <= 0) return '0/0'
  return `${dispatchedQty}/${totalQty}`
}

export function dispatchTripProgress(dispatches: Dispatch[], orderId: string): string | undefined {
  const trips = dispatches.filter((d) => d.orderId === orderId)
  if (trips.length === 0) return undefined
  const delivered = trips.filter((d) => d.status === 'delivered').length
  return `${delivered}/${trips.length} trips`
}

export function designLaneIndex(assigneeId: string | undefined, laneCount: number): number {
  if (laneCount <= 1) return 0
  if (!assigneeId) return 0
  let hash = 0
  for (let i = 0; i < assigneeId.length; i++) {
    hash = (hash * 31 + assigneeId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % laneCount
}

export function resolveFlowColumnId(
  enquiry: Enquiry,
  order: Order | undefined,
): { columnId: FlowColumnId; tracks: FlowProductionTrack[] } {
  const displayStage = resolveWorkflowDisplayStage(enquiry)

  if (displayStage === 'completed') {
    return { columnId: 'completed', tracks: [null] }
  }
  if (displayStage === 'dispatch') {
    return { columnId: 'dispatch', tracks: [null] }
  }
  if (displayStage === 'enquiry') {
    return { columnId: 'enquiry', tracks: [null] }
  }
  if (displayStage === 'design_review') {
    return { columnId: 'design_review', tracks: [null] }
  }
  if (displayStage === 'approval_processing' || isApprovalProcessing(enquiry)) {
    return { columnId: 'approval_processing', tracks: [null] }
  }

  if (displayStage === 'manufacturing' && order) {
    if (order.status === 'production') {
      const tracks: FlowProductionTrack[] = []
      if (!order.straightDuctsCompleted) tracks.push('straight_ducts')
      if (!order.plasmaDuctsCompleted) tracks.push('plasma_ducts')
      if (tracks.length === 0) {
        return { columnId: 'dispatch', tracks: [null] }
      }
      return { columnId: 'production', tracks }
    }
    if (order.status === 'ready' || order.status === 'partially_dispatched') {
      return { columnId: 'dispatch', tracks: [null] }
    }
  }

  return { columnId: displayStage === 'manufacturing' ? 'production' : 'enquiry', tracks: [null] }
}

export function findPhaseStart(enquiry: Enquiry, phase: Enquiry['activity'][0]['phase']): string | undefined {
  const matches = enquiry.activity
    .filter((a) => a.phase === phase)
    .map((a) => a.timestamp)
    .sort()
  return matches[0]
}

export function clientKeyForEnquiry(enquiry: Enquiry): { id: string; name: string } {
  const id = enquiry.customerId ?? `name:${enquiry.customerName.trim().toLowerCase()}`
  return { id, name: enquiry.customerName }
}

export function orderProgressLabel(order: Order): string {
  const dispatched = getOrderDispatchedQty(order)
  return formatDispatchProgress(dispatched, order.totalQuantity)
}
