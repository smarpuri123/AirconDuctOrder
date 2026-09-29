import { create } from 'zustand'
import { api, getToken, isApiMode } from '@/lib/api'
import {
  isPushSupported,
  pushSubscriptionToJson,
  subscribeToBrowserPush,
} from '@/lib/pushSubscription'
import type {
  NotificationDto,
  NotificationPreferences,
  ToastNotification,
  WsNotificationMessage,
} from '@/types/notifications'

type ListResponse = { items: NotificationDto[]; nextCursor: string | null }

interface NotificationState {
  notifications: NotificationDto[]
  nextCursor: string | null
  unreadCount: number
  isConnected: boolean
  preferences: NotificationPreferences
  vapidPublicKey: string | null
  pushConfigured: boolean
  loading: boolean
  toasts: ToastNotification[]
  ws: WebSocket | null
  reconnectTimer: ReturnType<typeof setTimeout> | null

  startSession: () => Promise<void>
  endSession: () => void
  fetchUnreadCount: () => Promise<void>
  fetchNotifications: (append?: boolean) => Promise<void>
  fetchPreferences: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  updatePreferences: (patch: Partial<NotificationPreferences>) => Promise<void>
  subscribeToPush: () => Promise<{ ok: boolean; reason?: string }>
  unsubscribeFromPush: () => Promise<void>
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  dismissToast: (id: string) => void
  handleRealtimeNotification: (dto: NotificationDto) => void
}

function wsUrl(): string {
  const token = getToken()
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = import.meta.env.VITE_WS_URL ?? `${protocol}//${window.location.host}`
  return `${host}/ws/notifications?token=${encodeURIComponent(token ?? '')}`
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  nextCursor: null,
  unreadCount: 0,
  isConnected: false,
  preferences: { inAppEnabled: true, pushEnabled: false },
  vapidPublicKey: null,
  pushConfigured: false,
  loading: false,
  toasts: [],
  ws: null,
  reconnectTimer: null,

  async startSession() {
    if (!isApiMode || !getToken()) return
    const { fetchUnreadCount, fetchNotifications, fetchPreferences, connectWebSocket } = get()
    try {
      const vapid = await api<{ publicKey: string | null; pushConfigured: boolean }>(
        '/notifications/vapid-public-key',
      )
      set({ vapidPublicKey: vapid.publicKey, pushConfigured: vapid.pushConfigured })
    } catch {
      /* optional */
    }
    await Promise.all([fetchUnreadCount(), fetchNotifications(false), fetchPreferences()])
    connectWebSocket()
  },

  endSession() {
    get().disconnectWebSocket()
    set({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
      toasts: [],
      isConnected: false,
    })
  },

  async fetchUnreadCount() {
    if (!isApiMode) return
    const { count } = await api<{ count: number }>('/notifications/unread-count')
    set({ unreadCount: count })
  },

  async fetchNotifications(append = false) {
    if (!isApiMode) return
    set({ loading: true })
    try {
      const cursor = append ? get().nextCursor : undefined
      const path = cursor
        ? `/notifications?cursor=${encodeURIComponent(cursor)}`
        : '/notifications'
      const data = await api<ListResponse>(path)
      set((s) => ({
        notifications: append ? [...s.notifications, ...data.items] : data.items,
        nextCursor: data.nextCursor,
        loading: false,
      }))
    } catch {
      set({ loading: false })
    }
  },

  async fetchPreferences() {
    if (!isApiMode) return
    const prefs = await api<NotificationPreferences>('/notifications/preferences')
    set({ preferences: prefs })
  },

  async markAsRead(id) {
    if (!isApiMode) return
    const row = await api<NotificationDto>(`/notifications/${id}/read`, { method: 'PATCH' })
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? row : n)),
      unreadCount: Math.max(0, s.unreadCount - (s.notifications.find((n) => n.id === id && !n.readAt) ? 1 : 0)),
    }))
    await get().fetchUnreadCount()
  },

  async markAllAsRead() {
    if (!isApiMode) return
    await api('/notifications/read-all', { method: 'PATCH' })
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      unreadCount: 0,
    }))
  },

  async updatePreferences(patch) {
    if (!isApiMode) return
    const prefs = await api<NotificationPreferences>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    set({ preferences: prefs })
  },

  async subscribeToPush() {
    if (!isApiMode) return { ok: false, reason: 'API mode required' }
    const { vapidPublicKey, pushConfigured } = get()
    if (!pushConfigured || !vapidPublicKey) {
      return { ok: false, reason: 'Push is not configured on the server' }
    }
    if (!isPushSupported()) {
      return { ok: false, reason: 'This browser does not support notifications' }
    }
    try {
      const sub = await subscribeToBrowserPush(vapidPublicKey)
      if (!sub) return { ok: false, reason: 'Permission denied' }
      await api('/notifications/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(pushSubscriptionToJson(sub)),
      })
      await get().updatePreferences({ pushEnabled: true })
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Subscribe failed' }
    }
  },

  async unsubscribeFromPush() {
    if (!isApiMode || !isPushSupported()) return
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await api('/notifications/push/subscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      await get().updatePreferences({ pushEnabled: false })
    } catch {
      /* ignore */
    }
  },

  connectWebSocket() {
    if (!isApiMode || !getToken()) return
    const existing = get().ws
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return
    }

    const ws = new WebSocket(wsUrl())
    set({ ws })

    ws.onopen = () => set({ isConnected: true })
    ws.onclose = () => {
      set({ isConnected: false, ws: null })
      const timer = get().reconnectTimer
      if (timer) clearTimeout(timer)
      if (!getToken()) return
      const reconnectTimer = setTimeout(() => get().connectWebSocket(), 3000)
      set({ reconnectTimer })
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsNotificationMessage | { type: string }
        if (msg.type === 'notification' && 'data' in msg) {
          get().handleRealtimeNotification(msg.data)
        }
      } catch {
        /* ignore */
      }
    }
  },

  disconnectWebSocket() {
    const { reconnectTimer, ws } = get()
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) {
      ws.onclose = null
      ws.close()
    }
    set({ ws: null, isConnected: false, reconnectTimer: null })
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  handleRealtimeNotification(dto) {
    set((s) => {
      const exists = s.notifications.some((n) => n.id === dto.id)
      const notifications = exists ? s.notifications : [dto, ...s.notifications]
      const unreadCount = dto.readAt ? s.unreadCount : s.unreadCount + (exists ? 0 : 1)
      const toasts = [
        ...s.toasts,
        {
          id: dto.id,
          title: dto.title,
          message: dto.message,
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      ].slice(-5)
      return { notifications, unreadCount, toasts }
    })
  },
}))
