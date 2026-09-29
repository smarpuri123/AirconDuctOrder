export type NotificationDto = {
  id: string
  title: string
  message: string
  type: string
  entityType: string | null
  entityId: string | null
  createdAt: string
  readAt: string | null
}

export type NotificationPreferences = {
  inAppEnabled: boolean
  pushEnabled: boolean
}

export type WsNotificationMessage = {
  type: 'notification'
  data: NotificationDto
}

export type ToastNotification = {
  id: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
}
