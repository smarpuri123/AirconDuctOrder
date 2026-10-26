import { reportClientLogToServer, shouldReportClientLogToServer } from '@/lib/clientLogReport'

export type ClientLogKind = 'api' | 'error' | 'info' | 'auth' | 'excel' | 'network'

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
  route?: string
}

const MAX_ENTRIES = 300
const STORAGE_KEY = 'ecovent_client_logs_v1'
const buffer: ClientLogEntry[] = []
const listeners = new Set<() => void>()
let seq = 0
let hydrated = false

function notify(): void {
  listeners.forEach((l) => l())
}

function persistBuffer(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(0, MAX_ENTRIES)))
  } catch {
    /* quota or private mode */
  }
}

function hydrateFromStorage(): void {
  if (hydrated || typeof localStorage === 'undefined') return
  hydrated = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as ClientLogEntry[]
    if (!Array.isArray(parsed)) return
    for (let i = parsed.length - 1; i >= 0; i--) {
      const e = parsed[i]
      if (e?.id && e.at && e.kind && e.message) buffer.push(e)
    }
    if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES
  } catch {
    /* ignore corrupt storage */
  }
}

export function subscribeClientLogs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function listClientLogs(limit = 200): ClientLogEntry[] {
  hydrateFromStorage()
  return buffer.slice(0, Math.min(limit, MAX_ENTRIES))
}

export function clearClientLogs(): void {
  buffer.length = 0
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
  notify()
}

export function pushClientLog(
  entry: Omit<ClientLogEntry, 'id' | 'at' | 'route'> & { at?: string; route?: string },
): void {
  hydrateFromStorage()
  const route =
    entry.route ??
    (typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined)

  const full: ClientLogEntry = {
    id: `cli-${Date.now()}-${++seq}`,
    at: entry.at ?? new Date().toISOString(),
    kind: entry.kind,
    message: entry.message,
    method: entry.method,
    path: entry.path,
    status: entry.status,
    durationMs: entry.durationMs,
    detail: entry.detail,
    route,
  }

  buffer.unshift(full)
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES
  persistBuffer()
  notify()

  if (shouldReportClientLogToServer(full)) {
    reportClientLogToServer(full)
  }
}

export function logAuthFailure(message: string, detail?: string): void {
  pushClientLog({ kind: 'auth', message, detail })
}

export function logExcelIssue(message: string, detail?: string): void {
  pushClientLog({ kind: 'excel', message, detail })
}

export function installClientLogCapture(): void {
  if (typeof window === 'undefined') return
  if ((window as unknown as { __ecoventLogsInstalled?: boolean }).__ecoventLogsInstalled) return
  ;(window as unknown as { __ecoventLogsInstalled?: boolean }).__ecoventLogsInstalled = true

  hydrateFromStorage()

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
