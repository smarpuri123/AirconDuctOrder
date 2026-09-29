import type { FastifyInstance } from 'fastify'
import { WebSocketServer } from 'ws'
import { addNotificationConnection } from '../lib/ws-connection-registry.js'

const WS_PATH = '/ws/notifications'

export function attachNotificationWebSocket(app: FastifyInstance): void {
  const wss = new WebSocketServer({ noServer: true })

  app.server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)
    if (url.pathname !== WS_PATH) {
      return
    }

    const token = url.searchParams.get('token')
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    try {
      const user = app.jwt.verify<{ id: string }>(token)
      wss.handleUpgrade(request, socket, head, (ws) => {
        addNotificationConnection(user.id, ws)
        ws.send(JSON.stringify({ type: 'connected' }))
      })
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  })
}
