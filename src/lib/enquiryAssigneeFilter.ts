import { isApprovalProcessing } from '@/lib/enquiryWorkflow'
import { isAccountsOnlyUser, isDesignerOnlyUser } from '@/lib/portalAccess'
import type { Enquiry } from '@/types/enquiry'

/**
 * Client-side guard on cached enquiry lists (API applies the same rules on GET /enquiries).
 */
export function filterEnquiriesForPortalView(
  enquiries: Enquiry[],
  roles: string[],
  employeeId?: string | null,
): Enquiry[] {
  if (isAccountsOnlyUser(roles)) {
    return enquiries.filter((e) => isApprovalProcessing(e))
  }
  if (isDesignerOnlyUser(roles)) {
    if (!employeeId) return []
    return enquiries.filter(
      (e) =>
        e.currentAssigneeId === employeeId && !isApprovalProcessing(e) && !e.orderId,
    )
  }
  return enquiries
}

/** @deprecated Use filterEnquiriesForPortalView */
export function filterEnquiriesForDesignerView(enquiries: Enquiry[]): Enquiry[] {
  return enquiries
}
