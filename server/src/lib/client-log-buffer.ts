export type ClientPortalLogEntry = {
  id: string
  at: string
  kind: string
  message: string
  method?: string
  path?: string
  status?: number
  durationMs?: number
  detail?: string
  route?: string
  pageUrl?: string
  userAgent?: string
  userId?: string | null
  username?: string | null
}

const MAX_ENTRIES = 400
const buffer: ClientPortalLogEntry[] = []
let seq = 0

export function pushClientPortalLog(
  entry: Omit<ClientPortalLogEntry, 'id' | 'at'> & { at?: string },
): void {
  buffer.unshift({
    id: `cpl-${Date.now()}-${++seq}`,
    at: entry.at ?? new Date().toISOString(),
    ...entry,
  })
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES
}

export function listClientPortalLogs(limit = 200): ClientPortalLogEntry[] {
  return buffer.slice(0, Math.min(limit, MAX_ENTRIES))
}

export function clearClientPortalLogs(): void {
  buffer.length = 0
}

export const clientPortalLogCapacity = MAX_ENTRIES
