import { isApiMode } from '@/lib/api'
import { getCurrentUser } from '@/lib/currentUser'
import { isApprovalProcessing } from '@/lib/enquiryWorkflow'
import type { Enquiry } from '@/types/enquiry'

/** Demo mode: match enquiries the acting design user is responsible for. */
export function isEnquiryAssignedToDemoDesigner(enquiry: Enquiry, designerName: string): boolean {
  if (enquiry.currentAssigneeName === designerName) return true
  if (enquiry.designReview.status === 'pending') return false
  if (['in_review', 'revision_needed'].includes(enquiry.designReview.status)) {
    return enquiry.activity.some((a) => a.phase === 'design' && a.actor === designerName)
  }
  if (isApprovalProcessing(enquiry)) {
    return enquiry.designReview.reviewedBy === designerName
  }
  return enquiry.designReview.reviewedBy === designerName
}

export function filterEnquiriesForDesignerView(enquiries: Enquiry[]): Enquiry[] {
  if (isApiMode) return enquiries
  const user = getCurrentUser()
  if (!user.role.toLowerCase().includes('design')) return enquiries
  return enquiries.filter((e) => isEnquiryAssignedToDemoDesigner(e, user.name))
}
