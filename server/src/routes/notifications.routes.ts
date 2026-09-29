import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../config.js'
import {
  createNotification,
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removePushSubscription,
  savePushSubscription,
  updateNotificationPreferences,
} from '../services/notification.service.js'

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications/vapid-public-key', async () => ({
    publicKey: config.vapidPublicKey || null,
    pushConfigured: Boolean(config.vapidPublicKey && config.vapidPrivateKey),
  }))

  app.get(
    '/notifications',
    { preHandler: [app.authenticate] },
    async (request) => {
      const userId = request.authUser!.id
      const { cursor, limit } = request.query as { cursor?: string; limit?: string }
      return listNotifications(userId, {
        cursor,
        limit: limit ? parseInt(limit, 10) : undefined,
      })
    },
  )

  app.get(
    '/notifications/unread-count',
    { preHandler: [app.authenticate] },
    async (request) => {
      const count = await getUnreadCount(request.authUser!.id)
      return { count }
    },
  )

  app.patch(
    '/notifications/:id/read',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const row = await markNotificationRead(request.authUser!.id, id)
      if (!row) return reply.code(404).send({ error: 'Notification not found' })
      return row
    },
  )

  app.patch(
    '/notifications/read-all',
    { preHandler: [app.authenticate] },
    async (request) => {
      const count = await markAllNotificationsRead(request.authUser!.id)
      return { count }
    },
  )

  app.get(
    '/notifications/preferences',
    { preHandler: [app.authenticate] },
    async (request) => getNotificationPreferences(request.authUser!.id),
  )

  app.patch(
    '/notifications/preferences',
    { preHandler: [app.authenticate] },
    async (request) => {
      const body = z
        .object({
          inAppEnabled: z.boolean().optional(),
          pushEnabled: z.boolean().optional(),
        })
        .parse(request.body)
      return updateNotificationPreferences(request.authUser!.id, body)
    },
  )

  app.post(
    '/notifications/push/subscribe',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!config.vapidPublicKey) {
        return reply.code(503).send({ error: 'Web Push is not configured on this server' })
      }
      const body = z
        .object({
          endpoint: z.string().url(),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
        })
        .parse(request.body)
      const ua = request.headers['user-agent']
      await savePushSubscription(request.authUser!.id, body, typeof ua === 'string' ? ua : undefined)
      await updateNotificationPreferences(request.authUser!.id, { pushEnabled: true })
      return { ok: true }
    },
  )

  app.delete(
    '/notifications/push/subscribe',
    { preHandler: [app.authenticate] },
    async (request) => {
      const body = z.object({ endpoint: z.string().url() }).parse(request.body)
      await removePushSubscription(request.authUser!.id, body.endpoint)
      return { ok: true }
    },
  )

  // Internal test — admins only via existing auth (any authenticated user for dev)
  app.post(
    '/notifications/test',
    { preHandler: [app.authenticate] },
    async (request) => {
      const userId = request.authUser!.id
      return createNotification({
        recipientId: userId,
        title: 'Test notification',
        message: 'Notification pipeline is working.',
        type: 'info',
        entityType: 'dispatch',
        entityId: 'demo',
      })
    },
  )
}
