import type { DesignReviewStatus, Enquiry } from '@/types/enquiry'

/** Design PO / accounts steps after engineering submits extraction. */
export const APPROVAL_PROCESSING_STATUSES: DesignReviewStatus[] = [
  'submitted_to_accounts',
  'po_for_review',
  'po_for_approval',
]

export function isApprovalProcessing(enquiry: Enquiry): boolean {
  if (enquiry.orderId) return false
  return (
    enquiry.stage === 'design_review' &&
    APPROVAL_PROCESSING_STATUSES.includes(enquiry.designReview.status)
  )
}

export function isDesignReviewWork(enquiry: Enquiry): boolean {
  if (enquiry.orderId) return false
  if (enquiry.stage !== 'design_review') return false
  if (enquiry.designReview.status === 'pending') return false
  if (isApprovalProcessing(enquiry)) return false
  if (enquiry.designReview.status === 'approved') return false
  return true
}

export function enquiryHasClientInput(enquiry: Enquiry): boolean {
  return Boolean(
    enquiry.drawingFile?.trim() ||
      (enquiry.designDocuments?.length ?? 0) > 0 ||
      enquiry.activity.some((a) => a.phase === 'design' && /client input|input files/i.test(a.title)),
  )
}

/** Intake not finished — counts toward sidebar “new enquiry” badge. */
export function needsEnquiryIntake(enquiry: Enquiry): boolean {
  return enquiry.stage === 'enquiry' && enquiry.designReview.status === 'pending'
}

/** Design review has started (team is working or past intake). */
export function isDesignAttended(enquiry: Enquiry): boolean {
  return enquiry.designReview.status !== 'pending'
}

/**
 * Enquiries sidebar badge: drawing received → design review not started yet.
 * Excludes new enquiries without input, active design, accounts, orders, etc.
 */
const EDITABLE_DESIGN_STATUSES: DesignReviewStatus[] = [
  'in_review',
  'revision_needed',
  'submitted_to_accounts',
  'po_for_review',
  'po_for_approval',
  'approved',
]

type OrderWorkflowSnapshot = {
  status: string
  items: { dispatchedQty: number }[]
}

export function isOrderWorkflowLocked(order?: OrderWorkflowSnapshot): boolean {
  if (!order) return false
  if (order.status === 'fully_dispatched' || order.status === 'closed') return true
  return order.items.some((i) => i.dispatchedQty > 0)
}

export function canEditDesignExtractionUi(enquiry: Enquiry, order?: OrderWorkflowSnapshot): boolean {
  if (isOrderWorkflowLocked(order)) return false
  const status = enquiry.designReview.status
  if (!EDITABLE_DESIGN_STATUSES.includes(status)) return false
  if (
    enquiry.orderId &&
    status !== 'in_review' &&
    status !== 'revision_needed'
  ) {
    return false
  }
  return true
}

/** Send design back while engineering is still extracting — not during accounts PO stages. */
export function canRequestDesignRevisionUi(enquiry: Enquiry, order?: OrderWorkflowSnapshot): boolean {
  if (isOrderWorkflowLocked(order)) return false
  if (canReturnToDesignUi(enquiry, order)) return false
  return enquiry.designReview.status === 'in_review'
}

export function previousDesignStatusUi(status: DesignReviewStatus): DesignReviewStatus | null {
  const map: Partial<Record<DesignReviewStatus, DesignReviewStatus>> = {
    submitted_to_accounts: 'in_review',
    po_for_review: 'submitted_to_accounts',
    po_for_approval: 'po_for_review',
    approved: 'po_for_approval',
  }
  return map[status] ?? null
}

export function canRevertDesignStepUi(enquiry: Enquiry, order?: OrderWorkflowSnapshot): boolean {
  if (isOrderWorkflowLocked(order)) return false
  return previousDesignStatusUi(enquiry.designReview.status) !== null
}

export function canReturnToDesignUi(enquiry: Enquiry, order?: OrderWorkflowSnapshot): boolean {
  if (isOrderWorkflowLocked(order)) return false
  return (
    APPROVAL_PROCESSING_STATUSES.includes(enquiry.designReview.status) ||
    enquiry.designReview.status === 'approved'
  )
}

export function awaitingDesignStart(enquiry: Enquiry): boolean {
  if (enquiry.orderId) return false
  if (enquiry.designReview.status !== 'pending') return false

  const designReceived =
    enquiryHasClientInput(enquiry) ||
    enquiry.stage === 'design_review' ||
    enquiry.activity.some((a) => a.title === 'Enquiry intake completed')

  return designReceived
}
