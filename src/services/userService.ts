import { api } from '@/lib/api'
import type { AssignablePortalUser, PortalUser } from '@/types/portalUser'

export type CreatePortalUserInput = {
  username: string
  name: string
  password: string
  phone?: string
  email?: string
  roleCode: string
}

export const userService = {
  /** All Settings portal users (enquiry responsibility). */
  async listAssignableUsers(stage?: string): Promise<AssignablePortalUser[]> {
    const q = stage ? `?stage=${encodeURIComponent(stage)}` : ''
    return api<AssignablePortalUser[]>(`/users/assignable${q}`)
  },

  async listUsers(): Promise<PortalUser[]> {
    return api<PortalUser[]>('/users')
  },

  async createUser(input: CreatePortalUserInput): Promise<PortalUser> {
    return api<PortalUser>('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async updateUser(
    id: string,
    input: { name?: string; phone?: string; active?: boolean },
  ): Promise<PortalUser> {
    return api<PortalUser>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  async resetPassword(id: string, password: string): Promise<void> {
    await api(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  },
}
