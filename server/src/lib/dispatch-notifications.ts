import { getDispatchNotificationRecipients } from './notification-recipients.js'
import { createNotificationsForUsers } from '../services/notification.service.js'

const STATUS_LABEL: Record<string, string> = {
  LOADING: 'Loading',
  LOADED: 'Loaded',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
}

export function notifyDispatchCreated(params: {
  dispatchId: string
  dispatchNo: string
  orderNo: string
  actorUserId: string
}): void {
  void (async () => {
    const recipients = await getDispatchNotificationRecipients(params.actorUserId)
    await createNotificationsForUsers(recipients, {
      title: 'New dispatch trip',
      message: `${params.dispatchNo} created for order ${params.orderNo}`,
      type: 'dispatch',
      entityType: 'dispatch',
      entityId: params.dispatchId,
    })
  })()
}

export function notifyDispatchStatusUpdated(params: {
  dispatchId: string
  dispatchNo: string
  status: string
  actorUserId?: string
}): void {
  void (async () => {
    const label = STATUS_LABEL[params.status.toUpperCase()] ?? params.status
    const recipients = await getDispatchNotificationRecipients(params.actorUserId)
    await createNotificationsForUsers(recipients, {
      title: `Dispatch ${label}`,
      message: `${params.dispatchNo} marked as ${label.toLowerCase()}`,
      type: 'dispatch',
      entityType: 'dispatch',
      entityId: params.dispatchId,
    })
  })()
}
