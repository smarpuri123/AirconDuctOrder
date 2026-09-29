import type { WebSocket } from 'ws'

const connections = new Map<string, Set<WebSocket>>()

export function addNotificationConnection(userId: string, socket: WebSocket): void {
  let set = connections.get(userId)
  if (!set) {
    set = new Set()
    connections.set(userId, set)
  }
  set.add(socket)
  socket.on('close', () => removeNotificationConnection(userId, socket))
  socket.on('error', () => removeNotificationConnection(userId, socket))
}

export function removeNotificationConnection(userId: string, socket: WebSocket): void {
  const set = connections.get(userId)
  if (!set) return
  set.delete(socket)
  if (set.size === 0) connections.delete(userId)
}

export function sendToUser(userId: string, payload: unknown): void {
  const set = connections.get(userId)
  if (!set?.size) return
  const data = JSON.stringify(payload)
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data)
    }
  }
}

export function disconnectUser(userId: string): void {
  const set = connections.get(userId)
  if (!set) return
  for (const ws of set) {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }
  connections.delete(userId)
}
