import { getOrderBalanceArea, getOrderBalanceQty, getOrderDispatchedArea, getOrderDispatchedQty, isToday } from '@/lib/calculations'
import { dispatchService } from './dispatchService'
import { orderService } from './orderService'
import type { DashboardStats } from '@/types'

export const reportService = {
  getDashboardStats(): DashboardStats {
    const orders = orderService.getOrders()
    const dispatches = dispatchService.getDispatches()
    const todayDispatches = dispatches.filter((d) => isToday(d.dispatchDate))

    return {
      totalOrders: orders.length,
      readyOrders: orders.filter((o) => o.status === 'ready').length,
      dispatchedOrders: orders.filter(
        (o) => o.status === 'partially_dispatched' || o.status === 'fully_dispatched',
      ).length,
      todayDispatches: todayDispatches.length,
      todayDispatchQty: todayDispatches.reduce((s, d) => s + d.totalQuantity, 0),
      pendingOrders: orders.filter(
        (o) => o.status !== 'fully_dispatched' && o.status !== 'cancelled',
      ).length,
      partiallyDispatched: orders.filter((o) => o.status === 'partially_dispatched').length,
      fullyDispatched: orders.filter((o) => o.status === 'fully_dispatched').length,
      totalDuctQty: orders.reduce((s, o) => s + o.totalQuantity, 0),
      totalArea: Math.round(orders.reduce((s, o) => s + o.totalArea, 0) * 100) / 100,
    }
  },

  getOrderReport() {
    return orderService.getOrders().map((order) => {
      const dispatchedQty = getOrderDispatchedQty(order)
      const balanceQty = getOrderBalanceQty(order)
      const dispatchedArea = getOrderDispatchedArea(order)
      const balanceArea = getOrderBalanceArea(order)
      return {
        orderNo: order.orderNo,
        customer: order.customerName,
        orderedQty: order.totalQuantity,
        producedQty: order.items.reduce((s, i) => s + i.producedQty, 0),
        dispatchedQty,
        balanceQty,
        orderedArea: order.totalArea,
        dispatchedArea: Math.round(dispatchedArea * 100) / 100,
        balanceArea,
        status: order.status,
      }
    })
  },

  getDailyDispatchReport() {
    const dispatches = dispatchService.getDispatches()
    const byDate = new Map<string, { date: string; trips: number; qty: number; area: number; vehicles: Set<string>; orders: Set<string> }>()

    for (const d of dispatches) {
      const existing = byDate.get(d.dispatchDate) ?? {
        date: d.dispatchDate,
        trips: 0,
        qty: 0,
        area: 0,
        vehicles: new Set<string>(),
        orders: new Set<string>(),
      }
      existing.trips++
      existing.qty += d.totalQuantity
      existing.area += d.totalArea
      existing.vehicles.add(d.vehicle.vehicleNumber)
      existing.orders.add(d.orderNo)
      byDate.set(d.dispatchDate, existing)
    }

    return Array.from(byDate.values())
      .map((r) => ({
        date: r.date,
        orders: r.orders.size,
        trips: r.trips,
        quantity: r.qty,
        area: Math.round(r.area * 100) / 100,
        vehicles: r.vehicles.size,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  },

  getVehicleReport() {
    const dispatches = dispatchService.getDispatches()
    const byVehicle = new Map<string, { vehicle: string; trips: number; qty: number; area: number; orders: Set<string> }>()

    for (const d of dispatches) {
      const v = d.vehicle.vehicleNumber
      const existing = byVehicle.get(v) ?? { vehicle: v, trips: 0, qty: 0, area: 0, orders: new Set<string>() }
      existing.trips++
      existing.qty += d.totalQuantity
      existing.area += d.totalArea
      existing.orders.add(d.orderNo)
      byVehicle.set(v, existing)
    }

    return Array.from(byVehicle.values()).map((r) => ({
      vehicle: r.vehicle,
      trips: r.trips,
      orders: r.orders.size,
      totalQty: r.qty,
      totalArea: Math.round(r.area * 100) / 100,
    }))
  },
}
