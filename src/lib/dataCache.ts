import { api, isApiMode } from '@/lib/api'

import type { Enquiry } from '@/types/enquiry'

import type { Dispatch, Order } from '@/types'



let ordersCache: Order[] | null = null

let dispatchesCache: Dispatch[] | null = null

let enquiriesCache: Enquiry[] | null = null

let cacheRevision = 0
const cacheListeners = new Set<() => void>()

export function getCacheRevision(): number {
  return cacheRevision
}

export function subscribeDataCache(listener: () => void): () => void {
  cacheListeners.add(listener)
  return () => cacheListeners.delete(listener)
}

function bumpCacheRevision(): void {
  cacheRevision += 1
  cacheListeners.forEach((listener) => listener())
}

/** Call after local-storage mutations so layout badges stay in sync. */
export function notifyLocalDataChanged(): void {
  bumpCacheRevision()
}



export function clearDataCache(): void {

  ordersCache = null

  dispatchesCache = null

  enquiriesCache = null

}



export function getCachedOrders(): Order[] | null {

  return ordersCache

}



export function getCachedDispatches(): Dispatch[] | null {

  return dispatchesCache

}



export function getCachedEnquiries(): Enquiry[] | null {

  return enquiriesCache

}



export function setCachedOrders(orders: Order[]): void {

  ordersCache = orders

}



export function setCachedDispatches(dispatches: Dispatch[]): void {

  dispatchesCache = dispatches

}



export function setCachedEnquiries(enquiries: Enquiry[]): void {

  enquiriesCache = enquiries

}



async function fetchOptional<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path)
  } catch {
    return null
  }
}

export async function hydrateFromApi(): Promise<void> {
  if (!isApiMode) return

  // Role-scoped: designer/accounts may lack orders or dispatches — skip 403s, load what is allowed.
  const [orders, dispatches, enquiries] = await Promise.all([
    fetchOptional<Order[]>('/orders'),
    fetchOptional<Dispatch[]>('/dispatches'),
    fetchOptional<Enquiry[]>('/enquiries'),
  ])

  ordersCache = orders ?? []
  dispatchesCache = dispatches ?? []
  enquiriesCache = enquiries ?? []
  bumpCacheRevision()
}



export async function refreshOrders(): Promise<Order[]> {

  if (!isApiMode) return []

  const orders = (await fetchOptional<Order[]>('/orders')) ?? []

  ordersCache = orders

  return orders

}



export async function refreshDispatches(): Promise<Dispatch[]> {

  if (!isApiMode) return []

  const dispatches = (await fetchOptional<Dispatch[]>('/dispatches')) ?? []

  dispatchesCache = dispatches

  return dispatches

}



export async function refreshEnquiries(): Promise<Enquiry[]> {

  if (!isApiMode) return []

  const enquiries = (await fetchOptional<Enquiry[]>('/enquiries')) ?? []

  enquiriesCache = enquiries

  return enquiries

}



export async function refreshAll(): Promise<void> {

  if (!isApiMode) return

  await hydrateFromApi()

}



export function findOrderByOrderNo(orderNo: string): Order | undefined {

  return ordersCache?.find((o) => o.orderNo === orderNo)

}


