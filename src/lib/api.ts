import { getCurrentUser } from '@/lib/currentUser'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export const isApiMode = import.meta.env.VITE_USE_API === 'true'

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

  // Demo mode only: optional “acting as” headers. API mode uses the logged-in JWT user on the server.
  if (!isApiMode) {
    const acting = getCurrentUser()
    headers['X-Operation-Actor-Name'] = acting.name
    headers['X-Operation-Actor-Role'] = acting.role
  }

  // Fastify rejects POST/PATCH with Content-Type: application/json and no body
  let body = options.body
  if (body === undefined && ['POST', 'PUT', 'PATCH'].includes(method)) {
    body = '{}'
  }
  if (body !== undefined && body !== null && body !== '') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, method, headers, body })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(body.error ?? body.message ?? 'Request failed', res.status)
  }

  return res.json() as Promise<T>
}

export interface AuthUser {
  id: string
  username: string
  email: string
  name: string
  roles: string[]
  permissions: string[]
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
