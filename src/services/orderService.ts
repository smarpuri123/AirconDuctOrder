import ordersSeed from '@/data/orders.json'
import dispatchesSeed from '@/data/dispatches.json'
import { api, isApiMode } from '@/lib/api'
import {
  getCachedDispatches,
  getCachedOrders,
  refreshAll,
  refreshOrders,
  setCachedOrders,
} from '@/lib/dataCache'
import { loadFromStorage, saveToStorage } from '@/lib/storage'
import { formatCustomerOrderNo } from '@/lib/orderNaming'
import {
  computeOrderStatus,
  getOrderBalanceArea,
  getOrderBalanceQty,
  getOrderDispatchedArea,
  getOrderDispatchedQty,
  sortOrderItemsByTagNo,
} from '@/lib/calculations'
import { getCurrentUser } from '@/lib/currentUser'
import { getTodayISO } from '@/lib/calculations'
import { enquiryService } from './enquiryService'
import type { Enquiry } from '@/types/enquiry'
import type { ProductionTrackAction } from '@/lib/productionTrack'
import { getProductionTrackStatus } from '@/lib/productionTrack'
import type { Dispatch, Order, OrderFilter, OrderItem } from '@/types'

function getOrderDispatches(orderId: string): Dispatch[] {
  const list = isApiMode
    ? (getCachedDispatches() ?? [])
    : loadFromStorage('dispatches', dispatchesSeed as Dispatch[])
  return list.filter((d) => d.orderId === orderId)
}

function getOrdersData(): Order[] {
  if (isApiMode) {
    const cached = getCachedOrders()
    if (cached) return cached
    return []
  }
  return loadFromStorage('orders', ordersSeed as Order[])
}

function persistOrders(orders: Order[]): void {
  if (isApiMode) {
    setCachedOrders(orders)
    return
  }
  saveToStorage('orders', JSON.stringify(orders))
}

function withComputedOrder(order: Order): Order {
  return {
    ...order,
    items: sortOrderItemsByTagNo(order.items),
    status: computeOrderStatus(order, getOrderDispatches(order.id)),
  }
}

export const orderService = {
  getOrders(): Order[] {
    return getOrdersData().map(withComputedOrder)
  },

  getOrderById(id: string): Order | undefined {
    const order = getOrdersData().find((o) => o.id === id)
    if (!order) return undefined
    return withComputedOrder(order)
  },

  getOrderByOrderNo(orderNo: string): Order | undefined {
    const order = getOrdersData().find((o) => o.orderNo === orderNo)
    if (!order) return undefined
    return withComputedOrder(order)
  },

  getOrderSummary(order: Order) {
    const dispatchedQty = getOrderDispatchedQty(order)
    const balanceQty = getOrderBalanceQty(order)
    const dispatchedArea = getOrderDispatchedArea(order)
    const balanceArea = getOrderBalanceArea(order)
    return { dispatchedQty, balanceQty, dispatchedArea, balanceArea }
  },

  searchOrders(query: string): Order[] {
    const q = query.toLowerCase().trim()
    if (!q) return this.getOrders()
    return this.getOrders().filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        o.jobName.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q),
    )
  },

  filterOrders(filter: OrderFilter): Order[] {
    const orders = this.getOrders()
    const today = new Date().toISOString().split('T')[0]

    switch (filter) {
      case 'ready':
        return orders.filter((o) => o.status === 'ready')
      case 'partial':
        return orders.filter((o) => o.status === 'partially_dispatched')
      case 'fully_dispatched':
        return orders.filter((o) => o.status === 'fully_dispatched')
      case 'today':
        return orders.filter((o) => o.productionDate === today || o.createdAt.startsWith(today))
      case 'overdue':
        return orders.filter(
          (o) =>
            o.status !== 'fully_dispatched' &&
            o.status !== 'cancelled' &&
            new Date(o.productionDate) < new Date(today),
        )
      default:
        return orders
    }
  },

  updateItemDispatchedQty(orderId: string, itemUpdates: { orderItemId: string; quantity: number }[]): void {
    const orders = getOrdersData()
    const orderIndex = orders.findIndex((o) => o.id === orderId)
    if (orderIndex === -1) return

    const order = { ...orders[orderIndex] }
    order.items = order.items.map((item) => {
      const update = itemUpdates.find((u) => u.orderItemId === item.id)
      if (!update) return item
      return { ...item, dispatchedQty: item.dispatchedQty + update.quantity }
    })
    order.status = computeOrderStatus(order, getOrderDispatches(orderId))
    orders[orderIndex] = order
    persistOrders(orders)
  },

  syncOrderStatus(orderId: string): Order | undefined {
    const orders = getOrdersData()
    const orderIndex = orders.findIndex((o) => o.id === orderId)
    if (orderIndex === -1) return undefined
    const order = {
      ...orders[orderIndex],
      status: computeOrderStatus(orders[orderIndex], getOrderDispatches(orderId)),
    }
    orders[orderIndex] = order
    persistOrders(orders)
    return withComputedOrder(order)
  },

  async refresh(): Promise<void> {
    if (isApiMode) await refreshOrders()
  },

  resetToSeed(): void {
    if (isApiMode) return
    persistOrders(ordersSeed as Order[])
  },

  getItemById(orderId: string, itemId: string): OrderItem | undefined {
    const order = this.getOrderById(orderId)
    return order?.items.find((i) => i.id === itemId)
  },

  createFromEnquiry(enquiry: Enquiry): Order {
    const orders = getOrdersData()
    const id = `ord-${Date.now()}`
    const dr = enquiry.designReview
    const ductLines = enquiry.ductLines ?? []
    let totalQty = dr.totalQty ?? 1
    let totalArea = dr.totalArea ?? 0

    let items: OrderItem[]

    if (ductLines.length > 0) {
      totalQty = ductLines.reduce((s, l) => s + l.quantity, 0)
      totalArea = Math.round(ductLines.reduce((s, l) => s + (l.area ?? 0), 0) * 100) / 100
      items = ductLines.map((line, i) => ({
        id: `item-${id}-${i + 1}`,
        orderId: id,
        tagNo: line.tagNo,
        description: line.description || 'OFLINE',
        w1: line.width,
        h1: line.height,
        w2: line.width,
        h2: line.height,
        length: line.length,
        orderedQty: line.quantity,
        area: line.area ?? 0,
        producedQty: 0,
        readyQty: 0,
        dispatchedQty: 0,
      }))
    } else {
      const tagCount = Math.max(dr.ductTags ?? 1, 1)
      items = Array.from({ length: tagCount }, (_, i) => {
        const baseQty = Math.floor(totalQty / tagCount)
        const remainder = totalQty % tagCount
        const qty = baseQty + (i < remainder ? 1 : 0)
        const area = Math.round((totalArea / tagCount) * 100) / 100
        return {
          id: `item-${id}-${i + 1}`,
          orderId: id,
          tagNo: String(i + 1),
          description: 'OFLINE',
          w1: 800,
          h1: 400,
          w2: 800,
          h2: 400,
          length: 900,
          orderedQty: qty || 1,
          area,
          producedQty: 0,
          readyQty: 0,
          dispatchedQty: 0,
        }
      })
    }

    const orderNo = formatCustomerOrderNo(enquiry.projectName, enquiry.enquiryNo)

    const order: Order = {
      id,
      orderNo,
      jobName: orderNo,
      customerId: `cust-new-${id}`,
      customerName: enquiry.customerName,
      productionDate: getTodayISO(),
      totalQuantity: totalQty,
      totalArea: totalArea,
      status: 'production',
      revision: 1,
      createdAt: new Date().toISOString(),
      items,
    }

    orders.push(order)
    persistOrders(orders)

    const user = getCurrentUser()
    enquiryService.appendActivity(enquiry.id, {
      phase: 'production',
      title: 'Production order created',
      detail: `${order.orderNo} · ${totalQty} qty`,
      actor: user.name,
      actorRole: user.role,
    })

    return order
  },

  async updateProductionTrack(
    orderId: string,
    process: 'straight_ducts' | 'plasma_ducts',
    action: ProductionTrackAction,
    note?: string,
  ): Promise<Order | undefined> {
    if (isApiMode) {
      const order = await api<Order>(`/orders/${orderId}/production-track`, {
        method: 'POST',
        body: JSON.stringify({ process, action, note }),
      })
      await refreshAll()
      return order
    }

    const orders = getOrdersData()
    const idx = orders.findIndex((o) => o.id === orderId)
    if (idx === -1) return undefined
    const user = getCurrentUser()
    const now = new Date().toISOString()
    const labels = { straight_ducts: 'Straight Ducts', plasma_ducts: 'Plasma Ducts' }

    const pauseOthers = (target: Order, proc: 'straight_ducts' | 'plasma_ducts') => {
      for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === target.id) continue
        if (orders[i].status !== 'production') continue
        const st = getProductionTrackStatus(orders[i], proc)
        if (st !== 'running') continue
        orders[i] = applyPause(orders[i], proc, now, user.name)
      }
    }

    const applyPause = (o: Order, proc: 'straight_ducts' | 'plasma_ducts', at: string, actor: string) => {
      const active = liveSeconds(o, proc, new Date(at))
      const patch =
        proc === 'straight_ducts'
          ? {
              straightDuctsStatus: 'paused' as const,
              straightDuctsActiveSeconds: active,
              straightDuctsRunStartedAt: undefined,
            }
          : {
              plasmaDuctsStatus: 'paused' as const,
              plasmaDuctsActiveSeconds: active,
              plasmaDuctsRunStartedAt: undefined,
            }
      enquiryService.appendActivityByOrderId(o.id, {
        phase: 'production',
        title: `${labels[proc]} — paused`,
        detail: `Auto-paused — another order took the line`,
        actor,
        actorRole: user.role,
      })
      return { ...o, ...patch }
    }

    const liveSeconds = (o: Order, proc: 'straight_ducts' | 'plasma_ducts', at: Date) => {
      const base =
        proc === 'straight_ducts' ? o.straightDuctsActiveSeconds ?? 0 : o.plasmaDuctsActiveSeconds ?? 0
      const st = getProductionTrackStatus(o, proc)
      if (st !== 'running') return base
      const started =
        proc === 'straight_ducts' ? o.straightDuctsRunStartedAt : o.plasmaDuctsRunStartedAt
      if (!started) return base
      return base + Math.max(0, Math.floor((at.getTime() - new Date(started).getTime()) / 1000))
    }

    let order = { ...orders[idx] }
    if (order.status !== 'production') {
      throw new Error('Order must be in production to update shop-floor tracks')
    }

    const status = getProductionTrackStatus(order, process)
    const log = (title: string, detail: string) => {
      enquiryService.appendActivityByOrderId(orderId, {
        phase: 'production',
        title,
        detail: note ?? detail,
        actor: user.name,
        actorRole: user.role,
        metadata: { productionProcess: process, productionTrackAction: action },
      })
    }

    if (action === 'start') {
      if (status !== 'not_started') throw new Error('Use resume to continue this line')
      pauseOthers(order, process)
      order = {
        ...order,
        productionApproved: true,
        productionApprovedBy: order.productionApprovedBy ?? user.name,
        productionApprovedDate: order.productionApprovedDate ?? now.split('T')[0],
        ...(process === 'straight_ducts'
          ? { straightDuctsStatus: 'running', straightDuctsRunStartedAt: now }
          : { plasmaDuctsStatus: 'running', plasmaDuctsRunStartedAt: now }),
      }
      log(`${labels[process]} — started`, `Shop floor timer started by ${user.name}`)
    } else if (action === 'resume') {
      if (status !== 'paused') throw new Error('Start this line before resuming')
      pauseOthers(order, process)
      order = {
        ...order,
        ...(process === 'straight_ducts'
          ? { straightDuctsStatus: 'running', straightDuctsRunStartedAt: now }
          : { plasmaDuctsStatus: 'running', plasmaDuctsRunStartedAt: now }),
      }
      log(`${labels[process]} — resumed`, `Resumed by ${user.name}`)
    } else if (action === 'pause') {
      if (status !== 'running') throw new Error('This line is not running')
      const active = liveSeconds(order, process, new Date())
      order = {
        ...order,
        ...(process === 'straight_ducts'
          ? {
              straightDuctsStatus: 'paused',
              straightDuctsActiveSeconds: active,
              straightDuctsRunStartedAt: undefined,
            }
          : {
              plasmaDuctsStatus: 'paused',
              plasmaDuctsActiveSeconds: active,
              plasmaDuctsRunStartedAt: undefined,
            }),
      }
      log(`${labels[process]} — paused`, `Paused by ${user.name}`)
    } else if (action === 'complete') {
      const active = liveSeconds(order, process, new Date())
      order = {
        ...order,
        ...(process === 'straight_ducts'
          ? {
              straightDuctsStatus: 'completed',
              straightDuctsActiveSeconds: active,
              straightDuctsRunStartedAt: undefined,
              straightDuctsCompleted: true,
              straightDuctsCompletedAt: now,
              straightDuctsCompletedBy: user.name,
            }
          : {
              plasmaDuctsStatus: 'completed',
              plasmaDuctsActiveSeconds: active,
              plasmaDuctsRunStartedAt: undefined,
              plasmaDuctsCompleted: true,
              plasmaDuctsCompletedAt: now,
              plasmaDuctsCompletedBy: user.name,
            }),
      }
      log(`${labels[process]} — complete`, `Marked by ${user.name}`)
    }

    orders[idx] = order
    persistOrders(orders)
    return order
  },

  async approveProductionStart(orderId: string): Promise<Order | undefined> {
    if (isApiMode) {
      const order = await api<Order>(`/orders/${orderId}/approve-production`, { method: 'POST' })
      await refreshAll()
      return order
    }
    const orders = getOrdersData()
    const idx = orders.findIndex((o) => o.id === orderId)
    if (idx === -1) return undefined

    const user = getCurrentUser()
    const today = getTodayISO()
    const order = {
      ...orders[idx],
      productionApproved: true,
      productionApprovedBy: user.name,
      productionApprovedDate: today,
    }
    orders[idx] = order
    persistOrders(orders)

    enquiryService.appendActivityByOrderId(orderId, {
      phase: 'production',
      title: 'Production start approved',
      detail: `${user.name} approved shop floor to begin fabrication`,
      actor: user.name,
      actorRole: user.role,
    })

    return order
  },

  async completeProductionProcess(
    orderId: string,
    process: 'straight_ducts' | 'plasma_ducts',
  ): Promise<Order | undefined> {
    if (isApiMode) {
      const order = await api<Order>(`/orders/${orderId}/production-process`, {
        method: 'POST',
        body: JSON.stringify({ process }),
      })
      await refreshAll()
      return order
    }
    return orderService.updateProductionTrack(orderId, process, 'complete')
  },

  async markProductionReady(orderId: string): Promise<Order | undefined> {
    if (isApiMode) {
      const order = await api<Order>(`/orders/${orderId}/mark-ready`, { method: 'POST' })
      await refreshAll()
      return order
    }
    const orders = getOrdersData()
    const idx = orders.findIndex((o) => o.id === orderId)
    if (idx === -1) return undefined

    const order = { ...orders[idx] }
    if (!order.straightDuctsCompleted || !order.plasmaDuctsCompleted) {
      throw new Error('Complete Straight Ducts and Plasma Ducts production before marking ready')
    }
    order.items = order.items.map((item) => ({
      ...item,
      producedQty: item.orderedQty,
      readyQty: item.orderedQty,
    }))
    order.status = 'ready'
    orders[idx] = order
    persistOrders(orders)

    const user = getCurrentUser()
    enquiryService.appendActivityByOrderId(orderId, {
      phase: 'production',
      title: 'Marked ready for dispatch',
      detail: 'All production processes complete — stock ready for dispatch',
      actor: user.name,
      actorRole: user.role,
    })

    return order
  },

  async revertOrderWorkflowStep(orderId: string, reason: string): Promise<Order | undefined> {
    if (isApiMode) {
      const order = await api<Order>(`/orders/${orderId}/revert-step`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      await refreshAll()
      return order
    }
    return undefined
  },
}
