import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isApiMode } from '@/lib/api'
import { canAccessPortalPath, defaultPortalPath } from '@/lib/portalAccess'
import { usePortalRoles } from '@/hooks/usePortalRoles'

/** Redirects users away from routes their role cannot access. */
export function PortalAccessGate() {
  const location = useLocation()
  const roles = usePortalRoles()

  if (!isApiMode) {
    return <Outlet />
  }

  if (roles.length === 0) {
    return <Outlet />
  }

  if (!canAccessPortalPath(roles, location.pathname)) {
    return <Navigate to={defaultPortalPath(roles)} replace />
  }

  return <Outlet />
}
