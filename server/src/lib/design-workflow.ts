/** Database design_status values on enquiries. */
export const DESIGN_STATUSES = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  REVISION_NEEDED: 'REVISION_NEEDED',
  SUBMITTED_TO_ACCOUNTS: 'SUBMITTED_TO_ACCOUNTS',
  PO_FOR_REVIEW: 'PO_FOR_REVIEW',
  PO_FOR_APPROVAL: 'PO_FOR_APPROVAL',
  APPROVED: 'APPROVED',
} as const

export type DesignStatusDb = (typeof DESIGN_STATUSES)[keyof typeof DESIGN_STATUSES]

/** One step back in the accounts / PO pipeline (not from IN_REVIEW — use request revision instead). */
const PREVIOUS_DESIGN_STATUS: Partial<Record<DesignStatusDb, DesignStatusDb>> = {
  [DESIGN_STATUSES.SUBMITTED_TO_ACCOUNTS]: DESIGN_STATUSES.IN_REVIEW,
  [DESIGN_STATUSES.PO_FOR_REVIEW]: DESIGN_STATUSES.SUBMITTED_TO_ACCOUNTS,
  [DESIGN_STATUSES.PO_FOR_APPROVAL]: DESIGN_STATUSES.PO_FOR_REVIEW,
  [DESIGN_STATUSES.APPROVED]: DESIGN_STATUSES.PO_FOR_APPROVAL,
}

export function previousDesignStatus(current: string): DesignStatusDb | null {
  return PREVIOUS_DESIGN_STATUS[current as DesignStatusDb] ?? null
}

export const APPROVAL_PROCESSING_STATUSES: DesignStatusDb[] = [
  DESIGN_STATUSES.SUBMITTED_TO_ACCOUNTS,
  DESIGN_STATUSES.PO_FOR_REVIEW,
  DESIGN_STATUSES.PO_FOR_APPROVAL,
]

export type DesignWorkflowContext = {
  hasCustomerOrder: boolean
  orderDelivered: boolean
}

/** Design work allowed (extraction, Excel import). With a linked order, only while back in design review. */
export function canEditDesignExtraction(
  designStatus: string,
  ctx: DesignWorkflowContext,
): boolean {
  if (ctx.orderDelivered) return false
  const editable: DesignStatusDb[] = [
    DESIGN_STATUSES.IN_REVIEW,
    DESIGN_STATUSES.REVISION_NEEDED,
    DESIGN_STATUSES.SUBMITTED_TO_ACCOUNTS,
    DESIGN_STATUSES.PO_FOR_REVIEW,
    DESIGN_STATUSES.PO_FOR_APPROVAL,
    DESIGN_STATUSES.APPROVED,
  ]
  if (!editable.includes(designStatus as DesignStatusDb)) return false
  if (ctx.hasCustomerOrder) {
    const designOnly: DesignStatusDb[] = [
      DESIGN_STATUSES.IN_REVIEW,
      DESIGN_STATUSES.REVISION_NEEDED,
    ]
    if (!designOnly.includes(designStatus as DesignStatusDb)) return false
  }
  return true
}

/** While design is in review only — accounts PO stages use `returnToDesignFromApproval`. */
export function canRequestDesignRevision(designStatus: string, orderDelivered: boolean): boolean {
  if (orderDelivered) return false
  if (
    [...APPROVAL_PROCESSING_STATUSES, DESIGN_STATUSES.APPROVED].includes(
      designStatus as DesignStatusDb,
    )
  ) {
    return false
  }
  return designStatus === DESIGN_STATUSES.IN_REVIEW
}

export function canRevertDesignStep(designStatus: string, orderDelivered: boolean): boolean {
  if (orderDelivered) return false
  return previousDesignStatus(designStatus) !== null
}

export function designStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending intake',
    IN_REVIEW: 'In design review',
    REVISION_NEEDED: 'Revision needed',
    SUBMITTED_TO_ACCOUNTS: 'Submitted to accounts',
    PO_FOR_REVIEW: 'PO for review',
    PO_FOR_APPROVAL: 'PO for approval',
    APPROVED: 'Approved',
  }
  return labels[status] ?? status
}
