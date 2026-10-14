export type ApiRequestLogEntry = {
  id: string
  at: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  userId: string | null
  username: string | null
  errorMessage?: string
}

const MAX_ENTRIES = 400
const buffer: ApiRequestLogEntry[] = []

let seq = 0

export function pushApiRequestLog(entry: Omit<ApiRequestLogEntry, 'id'>): void {
  buffer.unshift({
    id: `req-${Date.now()}-${++seq}`,
    ...entry,
  })
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES
}

export function listApiRequestLogs(limit = 200): ApiRequestLogEntry[] {
  return buffer.slice(0, Math.min(limit, MAX_ENTRIES))
}

export function clearApiRequestLogs(): void {
  buffer.length = 0
}

export const apiRequestLogCapacity = MAX_ENTRIES
