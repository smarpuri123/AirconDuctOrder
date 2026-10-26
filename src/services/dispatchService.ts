import dispatchesSeed from '@/data/dispatches.json'
import { api, isApiMode } from '@/lib/api'
import {
  getCachedDispatches,
  refreshDispatches,
  refreshOrders,
  setCachedDispatches,
} from '@/lib/dataCache'
import { loadFromStorage, saveToStorage } from '@/lib/storage'
import { getCurrentUser } from '@/lib/currentUser'
import { computeDispatchArea } from '@/lib/calculations'
import { canTransitionDispatchTo, normalizeDispatchStatus } from '@/lib/dispatchWorkflow'
import { enquiryService } from './enquiryService'
import { orderService } from './orderService'
import type {
  Dispatch,
  DispatchAccessories,
  DispatchItem,
  DispatchStatus,
  VehicleDetails,
} from '@/types'

function normalizeLoadedTripStatus(list: Dispatch[]): Dispatch[] {
  return list.map((d) =>
    d.status === 'loading' && (d.items?.length ?? 0) > 0 ? { ...d, status: 'loaded' } : d,
  )
}

function getDispatchesData(): Dispatch[] {
  if (isApiMode) {
    const cached = getCachedDispatches()
    if (cached) return normalizeLoadedTripStatus(cached)
    return []
  }
  return normalizeLoadedTripStatus(loadFromStorage('dispatches', dispatchesSeed as Dispatch[]))
}

function persistDispatches(dispatches: Dispatch[]): void {
  if (isApiMode) {
    setCachedDispatches(dispatches)
    return
  }
  saveToStorage('dispatches', JSON.stringify(dispatches))
}

function getNextDispatchNo(): string {
  const counter = loadFromStorage('dispatchCounter', 99)
  const next = counter + 1
  saveToStorage('dispatchCounter', next)
  return `D-2026-${String(next).padStart(4, '0')}`
}

export const dispatchService = {
  getDispatches(): Dispatch[] {
    return getDispatchesData()
  },

  getDispatchById(id: string): Dispatch | undefined {
    return getDispatchesData().find((d) => d.id === id)
  },

  getDispatchesByOrderId(orderId: string): Dispatch[] {
    return getDispatchesData()
      .filter((d) => d.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  getRecentDispatches(limit = 5): Dispatch[] {
    return getDispatchesData()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  },

  searchDispatches(query: string): Dispatch[] {
    const q = query.toLowerCase().trim()
    if (!q) return this.getDispatches()
    return this.getDispatches().filter(
      (d) =>
        d.dispatchNo.toLowerCase().includes(q) ||
        d.orderNo.toLowerCase().includes(q) ||
        d.vehicle.vehicleNumber.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q),
    )
  },

  /** Step 1: Create trip first with vehicle & driver details; marks status as 'loading'. */
  async createTrip(orderId: string, vehicle: VehicleDetails): Promise<Dispatch> {
    if (isApiMode) {
      const dispatch = await api<Dispatch>('/dispatches', {
        method: 'POST',
        body: JSON.stringify({
          customerOrderId: orderId,
          vehicle,
          items: {},
        }),
      })
      await Promise.all([refreshOrders(), refreshDispatches()])
      return dispatch
    }

    const order = orderService.getOrderById(orderId)
    if (!order) throw new Error('Order not found')

    const dispatch: Dispatch = {
      id: `disp-${Date.now()}`,
      dispatchNo: getNextDispatchNo(),
      orderId: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName,
      vehicle,
      items: [],
      totalQuantity: 0,
      totalArea: 0,
      status: 'loading',
      dispatchDate: vehicle.loadingDate,
      createdAt: new Date().toISOString(),
    }

    const dispatches = getDispatchesData()
    dispatches.push(dispatch)
    persistDispatches(dispatches)

    const tripNumber = this.getDispatchesByOrderId(orderId).length
    const user = getCurrentUser()
    enquiryService.appendActivityByOrderId(orderId, {
      phase: 'dispatch',
      title: `Dispatch Trip ${tripNumber} started (Loading)`,
      detail: `${dispatch.dispatchNo} · Vehicle ${vehicle.vehicleNumber} (${vehicle.driverName})`,
      actor: user.name,
      actorRole: user.role,
      revision: tripNumber,
    })

    return dispatch
  },

  /** Step 2 & 3: Save loaded ducts & accessories onto an active loading trip. */
  async saveDispatchLoad(
    dispatchId: string,
    quantities: Record<string, number>,
    accessories?: DispatchAccessories,
  ): Promise<Dispatch> {
    if (isApiMode) {
      const dispatch = await api<Dispatch>(`/dispatches/${dispatchId}/load`, {
        method: 'PUT',
        body: JSON.stringify({
          items: quantities,
          accessories,
        }),
      })
      await Promise.all([refreshOrders(), refreshDispatches()])
      return dispatch
    }

    const dispatches = getDispatchesData()
    const idx = dispatches.findIndex((d) => d.id === dispatchId)
    if (idx === -1) throw new Error('Dispatch trip not found')
    const existing = dispatches[idx]

    // Restore any previous item quantities from this trip before applying the new load
    if (existing.items.length > 0) {
      orderService.updateItemDispatchedQty(
        existing.orderId,
        existing.items.map((i) => ({ orderItemId: i.orderItemId, quantity: -i.quantity })),
      )
    }

    const order = orderService.getOrderById(existing.orderId)
    if (!order) throw new Error('Order not found')

    const items: DispatchItem[] = []
    const itemUpdates: { orderItemId: string; quantity: number }[] = []

    for (const orderItem of order.items) {
      const qty = quantities[orderItem.id] ?? 0
      if (qty <= 0) continue

      const available = orderItem.readyQty - orderItem.dispatchedQty
      if (qty > available) {
        throw new Error(
          `Cannot dispatch ${qty} for Duct ${orderItem.tagNo}. Only ${available} available.`,
        )
      }

      const unitArea = orderItem.orderedQty > 0 ? orderItem.area / orderItem.orderedQty : 0
      items.push({
        orderItemId: orderItem.id,
        tagNo: orderItem.tagNo,
        description: orderItem.description,
        w1: orderItem.w1,
        h1: orderItem.h1,
        w2: orderItem.w2,
        h2: orderItem.h2,
        length: orderItem.length,
        quantity: qty,
        area: Math.round(unitArea * qty * 100) / 100,
      })
      itemUpdates.push({ orderItemId: orderItem.id, quantity: qty })
    }

    if (items.length === 0) throw new Error('No items selected for dispatch')

    const totalQuantity = items.reduce((s, i) => s + i.quantity, 0)
    const totalArea = Math.round(computeDispatchArea(items) * 100) / 100

    const nextStatus: DispatchStatus =
      existing.status === 'loading' || existing.status === 'draft'
        ? 'loaded'
        : existing.status

    const updated: Dispatch = {
      ...existing,
      status: nextStatus,
      items,
      accessories,
      totalQuantity,
      totalArea,
    }
    dispatches[idx] = updated
    persistDispatches(dispatches)
    orderService.updateItemDispatchedQty(order.id, itemUpdates)

    const tripNumber = this.getDispatchesByOrderId(order.id).length
    const user = getCurrentUser()
    enquiryService.appendActivityByOrderId(order.id, {
      phase: 'dispatch',
      title: `Dispatch Trip ${tripNumber} loaded — Ready to deliver`,
      detail: `${updated.dispatchNo} · ${totalQuantity} qty · ${updated.vehicle.vehicleNumber}`,
      actor: user.name,
      actorRole: user.role,
      revision: tripNumber,
    })

    const updatedOrder = orderService.getOrderById(order.id)
    if (updatedOrder?.status === 'fully_dispatched') {
      enquiryService.appendActivityByOrderId(order.id, {
        phase: 'dispatch',
        title: 'Delivery completed',
        detail: 'All quantities dispatched — order closed',
        actor: user.name,
        actorRole: user.role,
      })
    }

    return updated
  },

  async createDispatch(
    orderId: string,
    quantities: Record<string, number>,
    vehicle: VehicleDetails,
    accessories?: DispatchAccessories,
    existingDispatchId?: string,
  ): Promise<Dispatch> {
    if (existingDispatchId) {
      return this.saveDispatchLoad(existingDispatchId, quantities, accessories)
    }

    if (isApiMode) {
      const dispatch = await api<Dispatch>('/dispatches', {
        method: 'POST',
        body: JSON.stringify({
          customerOrderId: orderId,
          vehicle,
          items: quantities,
          accessories,
        }),
      })
      await Promise.all([refreshOrders(), refreshDispatches()])
      return dispatch
    }

    const trip = await this.createTrip(orderId, vehicle)
    return this.saveDispatchLoad(trip.id, quantities, accessories)
  },

  async updateDispatchStatus(id: string, status: DispatchStatus): Promise<Dispatch> {
    if (isApiMode) {
      const dispatch = await api<Dispatch>(`/dispatches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await refreshDispatches()
      return dispatch
    }

    const dispatches = getDispatchesData()
    const idx = dispatches.findIndex((d) => d.id === id)
    if (idx === -1) throw new Error('Dispatch not found')
    const current = normalizeDispatchStatus(dispatches[idx].status)
    if (!canTransitionDispatchTo(current, status)) {
      throw new Error('Dispatch can only move forward to the next stage')
    }
    dispatches[idx] = { ...dispatches[idx], status }
    persistDispatches(dispatches)
    return dispatches[idx]
  },

  resetToSeed(): void {
    if (isApiMode) return
    persistDispatches(dispatchesSeed as Dispatch[])
    saveToStorage('dispatchCounter', 98)
  },
}
