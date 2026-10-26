import { create } from 'zustand'
import { clearToken, fetchMe, getToken, login as apiLogin, type AuthUser } from '@/lib/api'
import { hydrateFromApi, clearDataCache } from '@/lib/dataCache'
import { logAuthFailure } from '@/lib/clientLogBuffer'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  initialized: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  initialize: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  async login(username, password) {
    set({ loading: true })
    try {
      const { user } = await apiLogin(username, password)
      set({ user, loading: false, initialized: true })
      await hydrateFromApi()
    } catch (err) {
      set({ loading: false })
      const detail = err instanceof Error ? err.message : String(err)
      logAuthFailure(`Login failed for "${username}"`, detail)
      throw err
    }
  },

  logout() {
    clearToken()
    clearDataCache()
    set({ user: null, initialized: true })
  },

  async initialize() {
    const token = getToken()
    if (!token) {
      set({ initialized: true })
      return
    }

    set({ loading: true })
    try {
      const user = await fetchMe()
      await hydrateFromApi()
      set({ user, loading: false, initialized: true })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      logAuthFailure('Session restore failed (/auth/me)', detail)
      clearToken()
      set({ user: null, loading: false, initialized: true })
    }
  },

  hasPermission(permission) {
    const { user } = get()
    if (!user) return false
    if (user.roles.includes('ADMIN')) return true
    return user.permissions.includes(permission)
  },
}))
