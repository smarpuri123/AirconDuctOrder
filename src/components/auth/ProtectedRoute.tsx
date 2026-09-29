import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isApiMode } from '@/lib/api'
import { isDispatcherOnly } from '@/lib/portalAccess'
import { useAuthStore } from '@/store/authStore'

interface ProtectedRouteProps {
  loginPath?: string
  /** Block dispatcher-only users from the desktop operations shell. */
  desktopOnly?: boolean
}

export function ProtectedRoute({ loginPath = '/login', desktopOnly = false }: ProtectedRouteProps) {
  const location = useLocation()
  const { user, initialized, loading, initialize } = useAuthStore()

  useEffect(() => {
    if (!initialized) initialize()
  }, [initialized, initialize])

  if (!initialized || loading) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center bg-background">
        <p className="text-text-secondary">Loading...</p>
      </div>
    )
  }

  if (isApiMode && !user) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  }

  if (desktopOnly && isApiMode && user && isDispatcherOnly(user.roles)) {
    return <Navigate to="/m/orders" replace />
  }

  return <Outlet />
}
