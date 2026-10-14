import { PORTAL_ROLE_LABELS } from '@/lib/stagePortalRoles'
import { useAuthStore } from '@/store/authStore'

export type ActingUser = {
  id: string
  name: string
  role: string
}

/** Logged-in portal user (for client-side activity attribution where still used). */
export function getCurrentUser(): ActingUser {
  const auth = useAuthStore.getState().user
  if (!auth) {
    return { id: '', name: 'User', role: 'User' }
  }
  const roleCode = auth.roles[0] ?? 'USER'
  return {
    id: auth.id,
    name: auth.name,
    role: PORTAL_ROLE_LABELS[roleCode] ?? roleCode,
  }
}
