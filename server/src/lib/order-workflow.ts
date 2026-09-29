export function isOrderFullyDelivered(orderStatus: string): boolean {
  return orderStatus === 'FULLY_DISPATCHED' || orderStatus === 'CLOSED'
}

export function orderHasDispatches(items: { dispatchedQty: number }[]): boolean {
  return items.some((i) => i.dispatchedQty > 0)
}

/** Previous operational step for manufacturing (not dispatch — blocked when any qty dispatched). */
export function canRevertOrderStep(
  orderStatus: string,
  items: { dispatchedQty: number; readyQty: number; producedQty: number }[],
  productionApproved: boolean,
): boolean {
  if (isOrderFullyDelivered(orderStatus)) return false
  if (orderHasDispatches(items)) return false

  if (orderStatus === 'READY') return true
  if (orderStatus === 'IN_PRODUCTION' && productionApproved) return true
  if (
    orderStatus === 'IN_PRODUCTION' &&
    !productionApproved &&
    items.some((i) => i.readyQty > 0 || i.producedQty > 0)
  ) {
    return true
  }
  return false
}

export function describeOrderRevertTarget(orderStatus: string, productionApproved: boolean): string {
  if (orderStatus === 'READY') return 'Return order to in-production (clear ready stock flags)'
  if (orderStatus === 'IN_PRODUCTION' && productionApproved) {
    return 'Withdraw production start approval'
  }
  return 'Reset production quantities on line items'
}
