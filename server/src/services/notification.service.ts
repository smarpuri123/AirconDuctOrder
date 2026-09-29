import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { sendWebPushToUser } from '../lib/push-delivery.js'
import { sendToUser } from '../lib/ws-connection-registry.js'

export type CreateNotificationInput = {
  recipientId: string
  title: string
  message: string
  type?: string
  entityType?: string
  entityId?: string
  metadata?: Prisma.InputJsonValue
}

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

function mapRow(n: {
  id: string
  title: string
  message: string
  type: string
  entityType: string | null
  entityId: string | null
  createdAt: Date
  readAt: Date | null
}): NotificationDto {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    entityType: n.entityType,
    entityId: n.entityId,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
  }
}

async function getOrCreatePreferences(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}

async function deliverChannels(userId: string, dto: NotificationDto): Promise<void> {
  const prefs = await getOrCreatePreferences(userId)

  if (prefs.inAppEnabled) {
    sendToUser(userId, { type: 'notification', data: dto })
  }

  if (prefs.pushEnabled) {
    void sendWebPushToUser(userId, {
      title: dto.title,
      message: dto.message,
      entityType: dto.entityType ?? undefined,
      entityId: dto.entityId ?? undefined,
    })
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationDto> {
  const prefs = await getOrCreatePreferences(input.recipientId)
  if (!prefs.inAppEnabled && !prefs.pushEnabled) {
    const row = await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        title: input.title,
        message: input.message,
        type: input.type ?? 'info',
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    })
    return mapRow(row)
  }

  const row = await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  })
  const dto = mapRow(row)
  void deliverChannels(input.recipientId, dto)
  return dto
}

export async function createNotificationsForUsers(
  recipientIds: string[],
  input: Omit<CreateNotificationInput, 'recipientId'>,
): Promise<void> {
  const unique = [...new Set(recipientIds)]
  for (const recipientId of unique) {
    try {
      await createNotification({ ...input, recipientId })
    } catch (err) {
      console.error('Notification delivery failed for', recipientId, err)
    }
  }
}

export async function listNotifications(
  userId: string,
  options?: { cursor?: string; limit?: number },
): Promise<{ items: NotificationDto[]; nextCursor: string | null }> {
  const limit = Math.min(options?.limit ?? 30, 100)
  const rows = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(options?.cursor
      ? {
          cursor: { id: options.cursor },
          skip: 1,
        }
      : {}),
  })
  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map(mapRow)
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId: userId, readAt: null },
  })
}

export async function markNotificationRead(userId: string, id: string): Promise<NotificationDto | null> {
  const existing = await prisma.notification.findFirst({ where: { id, recipientId: userId } })
  if (!existing) return null
  if (existing.readAt) return mapRow(existing)
  const row = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  })
  return mapRow(row)
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  })
  return result.count
}

export async function getNotificationPreferences(userId: string) {
  const prefs = await getOrCreatePreferences(userId)
  return {
    inAppEnabled: prefs.inAppEnabled,
    pushEnabled: prefs.pushEnabled,
  }
}

export async function updateNotificationPreferences(
  userId: string,
  data: { inAppEnabled?: boolean; pushEnabled?: boolean },
) {
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      inAppEnabled: data.inAppEnabled ?? true,
      pushEnabled: data.pushEnabled ?? false,
    },
    update: {
      ...(data.inAppEnabled !== undefined ? { inAppEnabled: data.inAppEnabled } : {}),
      ...(data.pushEnabled !== undefined ? { pushEnabled: data.pushEnabled } : {}),
    },
  })
  return {
    inAppEnabled: prefs.inAppEnabled,
    pushEnabled: prefs.pushEnabled,
  }
}

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
) {
  return prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint: sub.endpoint } },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
    },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
    },
  })
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

export async function cleanupOldNotifications(retentionDays = 90): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const result = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff }, readAt: { not: null } },
  })
  return result.count
}
