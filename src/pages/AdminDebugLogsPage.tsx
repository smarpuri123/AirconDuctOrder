import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { RefreshCw, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import {
  clearClientLogs,
  listClientLogs,
  subscribeClientLogs,
  type ClientLogEntry,
  type ClientLogKind,
} from '@/lib/clientLogBuffer'
import { usePortalRoles } from '@/hooks/usePortalRoles'
import { canAccessAdminDebugLogs } from '@/lib/portalAccess'

type ApiRequestLogEntry = {
  id: string
  at: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  userId: string | null
  username: string | null
}

type PortalLogEntry = {
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

type DebugInfo = {
  service: string
  nodeEnv: string
  uptimeSeconds: number
  logging: Record<string, string | boolean>
}

const FRONTEND_KINDS: ClientLogKind[] = ['auth', 'network', 'excel', 'error', 'api']

function isFrontendProblem(entry: { kind: string; status?: number }): boolean {
  if (entry.kind === 'info') return false
  if (entry.kind === 'api') return (entry.status ?? 0) >= 400 || entry.status === 0
  return FRONTEND_KINDS.includes(entry.kind as ClientLogKind)
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function LogTable({
  rows,
  columns,
}: {
  rows: { key: string; cells: string[] }[]
  columns: string[]
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-secondary">No entries yet.</p>
  }
  return (
    <div className="overflow-auto border border-border rounded-lg max-h-[min(28rem,50vh)]">
      <table className="w-full text-xs">
        <thead className="bg-background sticky top-0 border-b border-border">
          <tr>
            {columns.map((c) => (
              <th key={c} className="p-2 text-left font-medium whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              {row.cells.map((cell, i) => (
                <td key={i} className="p-2 align-top whitespace-pre-wrap break-all max-w-md">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminDebugLogsPage() {
  const roles = usePortalRoles()
  const allowed = canAccessAdminDebugLogs(roles)

  const [clientLogs, setClientLogs] = useState<ClientLogEntry[]>(() => listClientLogs())
  const [portalLogs, setPortalLogs] = useState<PortalLogEntry[]>([])
  const [apiLogs, setApiLogs] = useState<ApiRequestLogEntry[]>([])
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [errorsOnly, setErrorsOnly] = useState(true)
  const [showBackendApi, setShowBackendApi] = useState(false)

  const refreshClient = useCallback(() => setClientLogs(listClientLogs()), [])

  const refreshPortalAndApi = useCallback(async () => {
    setLoadError('')
    try {
      const [portalRes, logsRes, infoRes] = await Promise.all([
        api<{ entries: PortalLogEntry[] }>('/debug/client-logs?limit=200'),
        api<{ entries: ApiRequestLogEntry[] }>('/debug/logs?limit=200'),
        api<DebugInfo>('/debug/info'),
      ])
      setPortalLogs(portalRes.entries)
      setApiLogs(logsRes.entries)
      setDebugInfo(infoRes)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load debug data')
    }
  }, [])

  const filteredPortalLogs = useMemo(
    () => (errorsOnly ? portalLogs.filter(isFrontendProblem) : portalLogs),
    [portalLogs, errorsOnly],
  )

  const filteredClientLogs = useMemo(
    () => (errorsOnly ? clientLogs.filter(isFrontendProblem) : clientLogs),
    [clientLogs, errorsOnly],
  )

  useEffect(() => {
    if (!allowed) return
    return subscribeClientLogs(refreshClient)
  }, [allowed, refreshClient])

  useEffect(() => {
    if (!allowed) return
    refreshPortalAndApi()
  }, [allowed, refreshPortalAndApi])

  useEffect(() => {
    if (!allowed || !autoRefresh) return
    const id = window.setInterval(refreshPortalAndApi, 5000)
    return () => window.clearInterval(id)
  }, [allowed, autoRefresh, refreshPortalAndApi])

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-semibold">Debug logs</h2>
        <p className="text-sm text-text-secondary mt-1">
          Frontend errors (login, network, Excel) are reported from any browser session. Stored in
          localStorage on this device until you clear them. Administrator only ·{' '}
          <code className="text-xs">/sys/debug</code>
        </p>
      </div>

      {loadError && <p className="text-error text-sm">{loadError}</p>}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 text-text-secondary">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
          />
          Problems only (hide successful API calls)
        </label>
        <label className="flex items-center gap-2 text-text-secondary">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh server buffer 5s
        </label>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Portal frontend errors (server buffer)</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={refreshPortalAndApi}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await api('/debug/client-logs/clear', { method: 'POST' })
                await refreshPortalAndApi()
              }}
            >
              <Trash2 className="w-4 h-4" />
              Clear server buffer
            </Button>
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          Includes failed logins when the API was down (<code className="text-xs">network</code>),
          auth failures, Excel import issues, and uncaught browser errors — even from users who are
          not logged in. Last ~400 events per API process; resets on deploy/restart.
        </p>
        <LogTable
          columns={['Time', 'Kind', 'Message', 'Route', 'User', 'Detail']}
          rows={filteredPortalLogs.map((e) => ({
            key: e.id,
            cells: [
              formatTime(e.at),
              e.kind,
              e.message,
              e.route ?? '—',
              e.username ?? '—',
              [e.detail, e.pageUrl].filter(Boolean).join('\n') || '—',
            ],
          }))}
        />
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">This browser (localStorage)</h3>
          <Button size="sm" variant="secondary" onClick={() => { clearClientLogs(); refreshClient() }}>
            <Trash2 className="w-4 h-4" />
            Clear local logs
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          Full history on this device (survives refresh). Use after a failed login on this machine,
          then sign in as admin and open this page.
        </p>
        <LogTable
          columns={['Time', 'Kind', 'Message', 'Status', 'Route', 'Detail']}
          rows={filteredClientLogs.map((e) => ({
            key: e.id,
            cells: [
              formatTime(e.at),
              e.kind,
              e.message,
              e.status != null ? String(e.status) : '—',
              e.route ?? '—',
              e.detail ?? '—',
            ],
          }))}
        />
      </Card>

      <Card className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left font-semibold"
          onClick={() => setShowBackendApi((v) => !v)}
        >
          Backend API request buffer (advanced)
          <span className="text-xs text-text-secondary font-normal">{showBackendApi ? 'Hide' : 'Show'}</span>
        </button>
        {showBackendApi && (
          <>
            {debugInfo && (
              <p className="text-xs text-text-secondary">
                {debugInfo.service} · {debugInfo.nodeEnv} · uptime {debugInfo.uptimeSeconds}s
              </p>
            )}
            <p className="text-xs text-text-secondary">
              In-memory log of requests that reached the API. Does not include browser-only failures.
              Full JSON logs: Docker <code className="text-xs">logs -f api</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await api('/debug/logs/clear', { method: 'POST' })
                  await refreshPortalAndApi()
                }}
              >
                <Trash2 className="w-4 h-4" />
                Clear API buffer
              </Button>
            </div>
            <LogTable
              columns={['Time', 'Method', 'Path', 'Status', 'ms', 'User']}
              rows={apiLogs.map((e) => ({
                key: e.id,
                cells: [
                  formatTime(e.at),
                  e.method,
                  e.path,
                  String(e.statusCode),
                  String(e.durationMs),
                  e.username ?? e.userId ?? '—',
                ],
              }))}
            />
          </>
        )}
      </Card>
    </div>
  )
}
