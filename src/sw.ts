/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

type PushPayload = {
  title?: string
  message?: string
  entityType?: string
  entityId?: string
}

function pathForEntity(entityType?: string, entityId?: string): string {
  const base = (self.registration.scope || '/').replace(/\/$/, '')
  if (!entityType || !entityId) return `${base}/` || '/'
  const t = entityType.toLowerCase()
  if (t === 'dispatch') return `${base}/dispatch/${entityId}`
  if (t === 'order') return `${base}/orders/${entityId}`
  if (t === 'enquiry') return `${base}/enquiries/${entityId}`
  return `${base}/`
}

self.addEventListener('push', (event) => {
  let data: PushPayload = { title: 'ECOVENT Dispatch', message: 'You have a new update' }
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch {
    /* use defaults */
  }
  const title = data.title ?? 'ECOVENT Dispatch'
  const body = data.message ?? ''
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { entityType: data.entityType, entityId: data.entityId },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const payload = event.notification.data as { entityType?: string; entityId?: string } | undefined
  const target = pathForEntity(payload?.entityType, payload?.entityId)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          const win = client as WindowClient
          void win.navigate(target)
          return win.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    }),
  )
})
