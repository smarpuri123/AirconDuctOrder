import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { isApiMode } from '@/lib/api'
import { mobileRouteForNotificationEntity, routeForNotificationEntity } from '@/lib/notificationRouting'
import { useNotificationStore } from '@/store/notificationStore'
import { NotificationPanel } from './NotificationPanel'

interface NotificationBellProps {
  mobile?: boolean
}

export function NotificationBell({ mobile }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAsRead = useNotificationStore((s) => s.markAsRead)

  if (!isApiMode) return null

  const handleNavigate = async (id: string, _path: string | null) => {
    const item = useNotificationStore.getState().notifications.find((n) => n.id === id)
    await markAsRead(id)
    setOpen(false)
    const routeFn = mobile ? mobileRouteForNotificationEntity : routeForNotificationEntity
    const path = item ? routeFn(item.entityType, item.entityId) : null
    if (path) navigate(path)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center rounded-lg touch-manipulation ${
          mobile
            ? 'w-10 h-10 bg-white/10 active:bg-white/20 text-white'
            : 'w-10 h-10 border border-border bg-surface hover:bg-background text-text-primary'
        }`}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
              mobile ? 'bg-white text-primary' : 'bg-primary text-white'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} onNavigate={handleNavigate} />
    </div>
  )
}
