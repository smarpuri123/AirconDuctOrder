import { useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'

const EMPTY_ROLES: string[] = []

export function usePortalRoles(): string[] {
  const authRoles = useAuthStore((s) => s.user?.roles)
  return useMemo(() => authRoles ?? EMPTY_ROLES, [authRoles])
}
