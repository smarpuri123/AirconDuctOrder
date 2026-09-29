import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { mobileRouteForNotificationEntity, routeForNotificationEntity } from '@/lib/notificationRouting'
import { useNotificationStore } from '@/store/notificationStore'

const TOAST_MS = 6000

export function NotificationToastStack() {
  const toasts = useNotificationStore((s) => s.toasts)
  const dismissToast = useNotificationStore((s) => s.dismissToast)
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const navigate = useNavigate()
  const location = useLocation()
  const mobile = location.pathname.startsWith('/m')

  useEffect(() => {
    if (!toasts.length) return
    const latest = toasts[toasts.length - 1]
    const t = setTimeout(() => dismissToast(latest.id), TOAST_MS)
    return () => clearTimeout(t)
  }, [toasts, dismissToast])

  if (!toasts.length) return null

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(100vw-2rem,20rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-surface border border-border rounded-lg shadow-level-2 p-4 flex gap-3"
        >
          <button
            type="button"
            className="flex-1 text-left min-w-0"
            onClick={() => {
              void markAsRead(t.id)
              dismissToast(t.id)
              const path = (mobile ? mobileRouteForNotificationEntity : routeForNotificationEntity)(
                t.entityType,
                t.entityId,
              )
              if (path) navigate(path)
            }}
          >
            <p className="font-semibold text-sm">{t.title}</p>
            <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">{t.message}</p>
          </button>
          <button
            type="button"
            className="shrink-0 text-text-secondary hover:text-text-primary"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
