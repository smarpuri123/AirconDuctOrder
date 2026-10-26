import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { orderService } from '@/services/orderService'
import { buildOperationsFlowSnapshot } from './buildSnapshot'
import { getOperationsFlowConfig } from './config'
import type { FlowSnapshot } from './types'

export function loadOperationsFlowSnapshot(): FlowSnapshot {
  const enquiries = enquiryService.getEnquiries().map((e) => enquiryService.withEffectiveStage(e))
  const orders = orderService.getOrders()
  const dispatches = dispatchService.getDispatches()
  const config = getOperationsFlowConfig()
  return buildOperationsFlowSnapshot({ enquiries, orders, dispatches, config })
}
