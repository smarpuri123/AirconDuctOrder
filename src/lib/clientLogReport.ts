import type { ClientLogEntry } from '@/lib/clientLogBuffer'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'ecovent_auth_token'

export function shouldReportClientLogToServer(entry: Pick<ClientLogEntry, 'kind' | 'status'>): boolean {
  if (entry.kind === 'api') return (entry.status ?? 0) >= 400
  if (entry.kind === 'info') return false
  return true
}

export function reportClientLogToServer(
  entry: Pick<
    ClientLogEntry,
    'kind' | 'message' | 'method' | 'path' | 'status' | 'durationMs' | 'detail' | 'route'
  >,
): void {
  if (typeof window === 'undefined') return

  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  void fetch(`${API_BASE}/debug/client-logs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...entry,
      pageUrl: window.location.href,
    }),
  }).catch(() => {
    /* server may be down — local buffer still has the entry */
  })
}
