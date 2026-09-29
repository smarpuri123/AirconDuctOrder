import * as XLSX from 'xlsx'
import type { Order } from '@/types'
import { getOrderBalanceArea, getOrderBalanceQty, getOrderDispatchedArea, getOrderDispatchedQty } from './calculations'
import { dispatchService } from '@/services/dispatchService'

export function exportOriginalOrder(order: Order): void {
  const data = order.items.map((item) => ({
    'DUCT NO': item.tagNo,
    DESCRIPTION: item.description,
    W1: item.w1,
    H1: item.h1,
    W2: item.w2,
    H2: item.h2,
    L: item.length,
    QTY: item.orderedQty,
    AREA: item.area,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Order')
  XLSX.writeFile(wb, `${order.orderNo}-order.xlsx`)
}

export function exportDispatchWise(order: Order): void {
  const dispatches = dispatchService.getDispatchesByOrderId(order.id)
  const data = dispatches.flatMap((d) =>
    d.items.map((item) => ({
      'Dispatch No': d.dispatchNo,
      'Order No': d.orderNo,
      Customer: d.customerName,
      Vehicle: d.vehicle.vehicleNumber,
      Date: d.dispatchDate,
      Tag: item.tagNo,
      Dimensions: `${item.w1}x${item.h1}x${item.length}`,
      Qty: item.quantity,
      Area: item.area,
    })),
  )
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dispatches')
  XLSX.writeFile(wb, `${order.orderNo}-dispatches.xlsx`)
}

export function exportOrderSummary(order: Order): void {
  const data = [{
    Order: order.orderNo,
    Customer: order.customerName,
    'Ordered Qty': order.totalQuantity,
    'Produced Qty': order.items.reduce((s, i) => s + i.producedQty, 0),
    'Dispatched Qty': getOrderDispatchedQty(order),
    'Balance Qty': getOrderBalanceQty(order),
    'Ordered Area': order.totalArea,
    'Dispatched Area': getOrderDispatchedArea(order),
    'Balance Area': getOrderBalanceArea(order),
    Status: order.status,
  }]
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Summary')
  XLSX.writeFile(wb, `${order.orderNo}-summary.xlsx`)
}

export function exportVehicleReport(): void {
  const dispatches = dispatchService.getDispatches()
  const byVehicle = new Map<string, { vehicle: string; trips: number; orders: Set<string>; qty: number; area: number }>()

  for (const d of dispatches) {
    const v = d.vehicle.vehicleNumber
    const e = byVehicle.get(v) ?? { vehicle: v, trips: 0, orders: new Set(), qty: 0, area: 0 }
    e.trips++
    e.orders.add(d.orderNo)
    e.qty += d.totalQuantity
    e.area += d.totalArea
    byVehicle.set(v, e)
  }

  const data = Array.from(byVehicle.values()).map((r) => ({
    Vehicle: r.vehicle,
    'No. of Trips': r.trips,
    Orders: r.orders.size,
    'Total Qty': r.qty,
    'Total Area': Math.round(r.area * 100) / 100,
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Vehicles')
  XLSX.writeFile(wb, 'vehicle-dispatch-report.xlsx')
}
