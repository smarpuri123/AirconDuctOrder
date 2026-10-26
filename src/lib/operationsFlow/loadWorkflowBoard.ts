import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { orderService } from '@/services/orderService'
import { buildEnquiryWorkflowBoard, type EnquiryWorkflowBoard } from './enquiryTrack'

export function loadEnquiryWorkflowBoard(): EnquiryWorkflowBoard {
  const enquiries = enquiryService.getEnquiriesForDashboard().map((e) =>
    enquiryService.withEffectiveStage(e),
  )
  const orders = orderService.getOrders()
  const dispatches = dispatchService.getDispatches()
  return buildEnquiryWorkflowBoard(enquiries, orders, dispatches)
}
