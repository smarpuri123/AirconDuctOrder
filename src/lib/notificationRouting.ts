const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export function routeForNotificationEntity(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): string | null {
  if (!entityType || !entityId) return null
  const t = entityType.toLowerCase()
  switch (t) {
    case 'dispatch':
      return `${base}/dispatch/${entityId}`
    case 'order':
      return `${base}/orders/${entityId}`
    case 'enquiry':
      return `${base}/enquiries/${entityId}`
    default:
      return null
  }
}

export function mobileRouteForNotificationEntity(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): string | null {
  if (!entityType || !entityId) return null
  const t = entityType.toLowerCase()
  if (t === 'dispatch') return `${base}/m/dispatches/${entityId}`
  if (t === 'order') return `${base}/m/orders/${entityId}`
  return routeForNotificationEntity(entityType, entityId)
}
