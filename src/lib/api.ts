import { pushClientLog } from '@/lib/clientLogBuffer'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

/** Always true — local-only mock mode was removed. */
export const isApiMode = true

const TOKEN_KEY = 'ecovent_auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const method = (options.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let body = options.body
  if (body === undefined && ['POST', 'PUT', 'PATCH'].includes(method)) {
    body = '{}'
  }
  if (body !== undefined && body !== null && body !== '') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  const started = performance.now()
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, method, headers, body })
  } catch (err) {
    const durationMs = Math.round(performance.now() - started)
    const detail = err instanceof Error ? err.message : String(err)
    pushClientLog({
      kind: 'network',
      message: `${method} ${path} — cannot reach server`,
      method,
      path,
      status: 0,
      durationMs,
      detail,
    })
    throw new ApiError(
      'Cannot reach the server. Check your connection or try again in a few minutes.',
      0,
    )
  }
  const durationMs = Math.round(performance.now() - started)

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const msg = body.error ?? body.message ?? 'Request failed'
    pushClientLog({
      kind: 'api',
      message: `${method} ${path} failed`,
      method,
      path,
      status: res.status,
      durationMs,
      detail: typeof msg === 'string' ? msg : JSON.stringify(msg),
    })
    throw new ApiError(msg, res.status)
  }

  pushClientLog({
    kind: 'api',
    message: `${method} ${path}`,
    method,
    path,
    status: res.status,
    durationMs,
  })

  return res.json() as Promise<T>
}

export interface AuthUser {
  id: string
  username: string
  email: string
  name: string
  roles: string[]
  permissions: string[]
  employeeId?: string | null
}

export async function login(username: string, password: string) {
  const data = await api<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(data.token)
  return data
}

export async function fetchMe() {
  const data = await api<{ user: AuthUser }>('/auth/me')
  return data.user
}
