import { productionFloorEngaged } from '@/lib/productionTrack'
import type { Order } from '@/types'

export function canRevertOrderStepUi(order: Order): boolean {
  if (order.status === 'fully_dispatched' || order.status === 'closed') return false
  if (order.items.some((i) => i.dispatchedQty > 0)) return false
  if (order.status === 'ready') return true
  if (order.status === 'production' && productionFloorEngaged(order)) return true
  if (
    order.status === 'production' &&
    order.items.some((i) => i.readyQty > 0 || i.producedQty > 0)
  ) {
    return true
  }
  return false
}

export function orderRevertStepLabel(order: Order): string {
  if (order.status === 'ready') return 'Step back to in-production'
  if (order.status === 'production' && productionFloorEngaged(order)) {
    return 'Reset shop-floor timers and progress'
  }
  return 'Reset production progress'
}
