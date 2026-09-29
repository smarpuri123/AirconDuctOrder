import webpush from 'web-push'
import { config } from '../config.js'
import { prisma } from './prisma.js'

let configured = false

function ensurePushConfigured(): boolean {
  if (configured) return true
  if (!config.vapidPublicKey || !config.vapidPrivateKey) return false
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)
  configured = true
  return true
}

export async function sendWebPushToUser(
  userId: string,
  payload: { title: string; message: string; entityType?: string; entityId?: string },
): Promise<void> {
  if (!ensurePushConfigured()) return

  const prefs = await prisma.notificationPreference.findUnique({ where: { userId } })
  if (prefs && !prefs.pushEnabled) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!subs.length) return

  const body = JSON.stringify({
    title: payload.title,
    message: payload.message,
    entityType: payload.entityType,
    entityId: payload.entityId,
  })

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      )
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined)
      }
    }
  }
}
