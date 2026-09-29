const STORAGE_KEY = 'ecovent-dispatch-data'

export interface StoredData {
  orders: string
  dispatches: string
  enquiries: string
  viewPreferences: string
  dispatchCounter: number
  crm: string
  masters: string
  enquiryFileBlobs: string
  org: string
}

export function loadFromStorage<T>(key: keyof StoredData, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const data = JSON.parse(raw) as Partial<StoredData>
    if (key === 'dispatchCounter') return (data.dispatchCounter ?? fallback) as T
    const value = data[key]
    if (!value) return fallback
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function saveToStorage<T extends keyof StoredData>(key: T, value: StoredData[T]): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data: Partial<StoredData> = raw ? JSON.parse(raw) : {}
    data[key] = value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore storage errors in demo
  }
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
}
