import { formatRelativeTime } from '@/lib/formatRelativeTime'
import type { NotificationDto } from '@/types/notifications'

interface NotificationItemProps {
  notification: NotificationDto
  onClick: () => void
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const unread = !notification.readAt
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-background transition-colors ${
        unread ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex gap-2 items-start">
        {unread && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden />}
        <div className={unread ? '' : 'pl-4'}>
          <p className="font-medium text-sm text-text-primary">{notification.title}</p>
          <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">{notification.message}</p>
          <p className="text-xs text-text-secondary mt-1">{formatRelativeTime(notification.createdAt)}</p>
        </div>
      </div>
    </button>
  )
}
