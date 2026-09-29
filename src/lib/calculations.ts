import type { Dispatch, Order, OrderItem, OrderStatus } from '@/types'
import { getDispatchStatusTitle, normalizeDispatchStatus } from '@/lib/dispatchWorkflow'

export function sortOrderItemsByTagNo<T extends { tagNo: string | number }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    String(a.tagNo).localeCompare(String(b.tagNo), undefined, { numeric: true }),
  )
}

export function getItemBalance(item: OrderItem): number {
  return item.orderedQty - item.dispatchedQty
}

export function getItemAvailable(item: OrderItem): number {
  return Math.min(item.readyQty - item.dispatchedQty, getItemBalance(item))
}

export function getOrderDispatchedQty(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.dispatchedQty, 0)
}

export function getOrderBalanceQty(order: Order): number {
  return order.totalQuantity - getOrderDispatchedQty(order)
}

export function getOrderDispatchedArea(order: Order): number {
  return order.items.reduce((sum, item) => {
    const unitArea = item.orderedQty > 0 ? item.area / item.orderedQty : 0
    return sum + unitArea * item.dispatchedQty
  }, 0)
}

export function getOrderBalanceArea(order: Order): number {
  return Math.round((order.totalArea - getOrderDispatchedArea(order)) * 100) / 100
}

export function getDispatchProgress(order: Order): number {
  if (order.totalQuantity === 0) return 0
  return Math.round((getOrderDispatchedQty(order) / order.totalQuantity) * 100)
}

export function computeOrderStatus(order: Order): OrderStatus {
  const dispatched = getOrderDispatchedQty(order)
  if (dispatched === 0) {
    if (order.status === 'production') return 'production'
    return 'ready'
  }
  if (dispatched >= order.totalQuantity) return 'fully_dispatched'
  return 'partially_dispatched'
}

export function formatDimensions(item: Pick<OrderItem, 'w1' | 'h1' | 'length'>): string {
  return `${item.w1} × ${item.h1} × ${item.length}`
}

export function formatArea(area: number): string {
  return `${area.toFixed(2)} m²`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function computeDispatchArea(
  items: { quantity: number; area: number; orderedQty?: number }[],
  orderItems?: OrderItem[],
): number {
  return items.reduce((sum, item) => {
    if (orderItems) {
      const orderItem = orderItems.find((oi) => oi.tagNo === (item as { tagNo?: number }).tagNo)
      if (orderItem && orderItem.orderedQty > 0) {
        const unitArea = orderItem.area / orderItem.orderedQty
        return sum + unitArea * item.quantity
      }
    }
    const orderedQty = item.orderedQty ?? item.quantity
    const unitArea = orderedQty > 0 ? item.area / orderedQty : 0
    return sum + unitArea * item.quantity
  }, 0)
}

export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function isToday(dateStr: string): boolean {
  return dateStr.startsWith(getTodayISO())
}

export function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    draft: 'Draft',
    imported: 'Imported',
    production: 'Production',
    ready: 'Ready',
    partially_dispatched: 'Partially Dispatched',
    fully_dispatched: 'Fully Dispatched',
    closed: 'Closed',
    cancelled: 'Cancelled',
  }
  return labels[status]
}

export function getDispatchStatusLabel(status: Dispatch['status']): string {
  return getDispatchStatusTitle(normalizeDispatchStatus(status))
}
