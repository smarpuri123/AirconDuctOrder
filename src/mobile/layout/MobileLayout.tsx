import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Package, Truck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const hideNav = /\/(dispatch|vehicle|preview|confirm)(\/|$)/.test(location.pathname)

  const handleLogout = () => {
    logout()
    navigate('/m/login')
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-20 bg-primary text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shadow-level-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-white/70 uppercase tracking-wide">ECOVENT</p>
            <h1 className="text-lg font-bold truncate">Dispatch</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell mobile />
            {user && (
              <span className="text-xs text-white/80 max-w-[120px] truncate hidden sm:block">{user.name}</span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 active:bg-white/20 touch-manipulation"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main
        className={`flex-1 min-h-0 overflow-y-auto px-4 py-4 ${
          hideNav ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <Outlet />
      </main>

      {!hideNav && (
      <nav
        className="fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-border px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-level-2"
      >
        <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
          <NavLink
            to="/m/orders"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 min-h-14 rounded-xl font-semibold text-sm touch-manipulation ${
                isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary'
              }`
            }
          >
            <Package className="w-6 h-6" />
            Orders
          </NavLink>
          <NavLink
            to="/m/dispatches"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 min-h-14 rounded-xl font-semibold text-sm touch-manipulation ${
                isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary'
              }`
            }
          >
            <Truck className="w-6 h-6" />
            Dispatches
          </NavLink>
        </div>
      </nav>
      )}
    </div>
  )
}
