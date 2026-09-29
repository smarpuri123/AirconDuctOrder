import { buildApp } from './app.js'
import { config } from './config.js'
import { attachNotificationWebSocket } from './ws/notifications-ws.js'
import { cleanupOldNotifications } from './services/notification.service.js'
import { prisma } from './lib/prisma.js'

const app = await buildApp()
attachNotificationWebSocket(app)

const RETENTION_DAYS = parseInt(process.env.NOTIFICATION_RETENTION_DAYS ?? '90', 10)
const retentionTimer = setInterval(() => {
  void cleanupOldNotifications(RETENTION_DAYS).then((count) => {
    if (count > 0) app.log.info({ count }, 'Cleaned up old notifications')
  })
}, 24 * 60 * 60 * 1000)

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info({ signal }, 'Shutting down')
  clearInterval(retentionTimer)
  try {
    await app.close()
  } catch (err) {
    app.log.error(err, 'Error closing HTTP server')
  }
  try {
    await prisma.$disconnect()
  } catch (err) {
    app.log.error(err, 'Error disconnecting database')
  }
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

try {
  await app.listen({ port: config.port, host: config.host })
  console.log(`ECOVENT API running at http://${config.host}:${config.port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
