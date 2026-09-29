import { useMemo } from 'react'
import { isApiMode } from '@/lib/api'
import { getCurrentUser } from '@/lib/currentUser'
import { demoActorRoleToPortalRoles } from '@/lib/portalAccess'
import { useAuthStore } from '@/store/authStore'

const EMPTY_ROLES: string[] = []

export function usePortalRoles(): string[] {
  const authRoles = useAuthStore((s) => s.user?.roles)

  return useMemo(() => {
    if (isApiMode) return authRoles ?? EMPTY_ROLES
    return demoActorRoleToPortalRoles(getCurrentUser().role)
  }, [authRoles])
}
