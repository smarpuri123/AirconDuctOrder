export type ClientLogKind = 'api' | 'error' | 'info'

export type ClientLogEntry = {
  id: string
  at: string
  kind: ClientLogKind
  message: string
  method?: string
  path?: string
  status?: number
  durationMs?: number
  detail?: string
}

const MAX_ENTRIES = 300
const buffer: ClientLogEntry[] = []
const listeners = new Set<() => void>()
let seq = 0

function notify(): void {
  listeners.forEach((l) => l())
}

export function subscribeClientLogs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function listClientLogs(limit = 200): ClientLogEntry[] {
  return buffer.slice(0, Math.min(limit, MAX_ENTRIES))
}

export function clearClientLogs(): void {
  buffer.length = 0
  notify()
}

export function pushClientLog(
  entry: Omit<ClientLogEntry, 'id' | 'at'> & { at?: string },
): void {
  buffer.unshift({
    id: `cli-${Date.now()}-${++seq}`,
    at: entry.at ?? new Date().toISOString(),
    kind: entry.kind,
    message: entry.message,
    method: entry.method,
    path: entry.path,
    status: entry.status,
    durationMs: entry.durationMs,
    detail: entry.detail,
  })
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES
  notify()
}

export function installClientLogCapture(): void {
  if (typeof window === 'undefined') return
  if ((window as unknown as { __ecoventLogsInstalled?: boolean }).__ecoventLogsInstalled) return
  ;(window as unknown as { __ecoventLogsInstalled?: boolean }).__ecoventLogsInstalled = true

  window.addEventListener('error', (event) => {
    pushClientLog({
      kind: 'error',
      message: event.message,
      detail: event.filename ? `${event.filename}:${event.lineno}` : undefined,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    pushClientLog({
      kind: 'error',
      message: reason instanceof Error ? reason.message : String(reason),
      detail: reason instanceof Error ? reason.stack : undefined,
    })
  })

  pushClientLog({
    kind: 'info',
    message: 'Client log buffer ready',
  })
}
