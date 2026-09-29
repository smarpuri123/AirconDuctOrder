import { useEffect, useRef } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { NotificationItem } from './NotificationItem'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  onNavigate: (notificationId: string, path: string | null) => void
}

export function NotificationPanel({ open, onClose, onNavigate }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { notifications, loading, nextCursor, fetchNotifications, markAllAsRead } = useNotificationStore()

  useEffect(() => {
    if (open) fetchNotifications(false)
  }, [open, fetchNotifications])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,22rem)] bg-surface border border-border rounded-lg shadow-level-2 z-50 overflow-hidden"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm">Notifications</h2>
        <button
          type="button"
          className="text-xs text-primary font-medium hover:underline"
          onClick={() => void markAllAsRead()}
        >
          Mark all read
        </button>
      </div>
      <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
        {notifications.length === 0 && !loading && (
          <p className="px-4 py-8 text-sm text-text-secondary text-center">No notifications yet</p>
        )}
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onClick={() => onNavigate(n.id, null)}
          />
        ))}
        {nextCursor && (
          <div className="p-3 border-t border-border">
            <button
              type="button"
              disabled={loading}
              className="w-full text-sm text-primary font-medium py-2 disabled:opacity-50"
              onClick={() => void fetchNotifications(true)}
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
