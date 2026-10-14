import { useCallback, useEffect, useState } from 'react'
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

type DebugInfo = {
  service: string
  nodeEnv: string
  uptimeSeconds: number
  logging: Record<string, string | boolean>
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
  const [apiLogs, setApiLogs] = useState<ApiRequestLogEntry[]>([])
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const refreshClient = useCallback(() => setClientLogs(listClientLogs()), [])

  const refreshApi = useCallback(async () => {
    setLoadError('')
    try {
      const [logsRes, infoRes] = await Promise.all([
        api<{ entries: ApiRequestLogEntry[] }>('/debug/logs?limit=200'),
        api<DebugInfo>('/debug/info'),
      ])
      setApiLogs(logsRes.entries)
      setDebugInfo(infoRes)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load API logs')
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    return subscribeClientLogs(refreshClient)
  }, [allowed, refreshClient])

  useEffect(() => {
    if (!allowed) return
    refreshApi()
  }, [allowed, refreshApi])

  useEffect(() => {
    if (!allowed || !autoRefresh) return
    const id = window.setInterval(refreshApi, 5000)
    return () => window.clearInterval(id)
  }, [allowed, autoRefresh, refreshApi])

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-semibold">Debug logs</h2>
        <p className="text-sm text-text-secondary mt-1">
          Administrator only · not linked in navigation ·{' '}
          <code className="text-xs">/sys/debug</code>
        </p>
      </div>

      {loadError && <p className="text-error text-sm">{loadError}</p>}

      {debugInfo && (
        <Card className="text-sm space-y-2">
          <p className="font-medium">API runtime</p>
          <p className="text-text-secondary">
            {debugInfo.service} · {debugInfo.nodeEnv} · uptime {debugInfo.uptimeSeconds}s
          </p>
          <ul className="text-text-secondary list-disc pl-5 space-y-1">
            {Object.entries(debugInfo.logging).map(([k, v]) => (
              <li key={k}>
                <span className="font-mono text-xs">{k}</span>: {String(v)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">API requests (in-memory buffer)</h3>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh 5s
            </label>
            <Button size="sm" variant="secondary" onClick={refreshApi}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await api('/debug/logs/clear', { method: 'POST' })
                await refreshApi()
              }}
            >
              <Trash2 className="w-4 h-4" />
              Clear API buffer
            </Button>
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          Last ~400 requests per API process. Resets on deploy/restart. Does not include request bodies.
          Full structured logs still go to the server process stdout (Docker/host logs).
        </p>
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
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Browser (this session)</h3>
          <Button size="sm" variant="secondary" onClick={() => { clearClientLogs(); refreshClient() }}>
            <Trash2 className="w-4 h-4" />
            Clear client logs
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          API calls from this tab, plus uncaught errors and unhandled promise rejections.
        </p>
        <LogTable
          columns={['Time', 'Kind', 'Message', 'Status', 'ms', 'Detail']}
          rows={clientLogs.map((e) => ({
            key: e.id,
            cells: [
              formatTime(e.at),
              e.kind,
              e.message,
              e.status != null ? String(e.status) : '—',
              e.durationMs != null ? String(e.durationMs) : '—',
              e.detail ?? '—',
            ],
          }))}
        />
      </Card>

      <Card className="text-sm text-text-secondary space-y-2">
        <p className="font-medium text-text-primary">Other logging (not on this page)</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>API (Fastify)</strong> — JSON logs on stdout when not in test mode; use your host or
            container log viewer in production.
          </li>
          <li>
            <strong>Enquiry workflow</strong> — business events in each enquiry&apos;s activity timeline
            (<code className="text-xs">enquiry_activities</code> in the database).
          </li>
          <li>
            <strong>Excel import audit</strong> — server-side import audit is not centralized yet.
          </li>
          <li>
            <strong>Database audit_logs</strong> — schema exists; API handlers do not write to it yet.
          </li>
        </ul>
      </Card>
    </div>
  )
}
