import { Outlet, useLocation } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { UserMenu } from '@/components/layout/UserMenu'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { Sidebar } from './Sidebar'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/workshop': 'Workshop',
  '/operations/flow': 'Workshop',
  '/enquiries': 'Enquiries',
  '/clients': 'Clients',
  '/orders': 'Orders',
  '/dispatch': 'Dispatch',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname === '/enquiries/new') return 'New Enquiry'
  if (pathname.startsWith('/enquiries/')) return 'Enquiry'
  if (pathname.startsWith('/orders/') && pathname.includes('/dispatch')) return 'Create Dispatch'
  if (pathname.startsWith('/orders/')) return 'Order'
  if (pathname.startsWith('/dispatch/')) return 'Dispatch'
  if (pathname.startsWith('/sys/debug')) return 'Debug logs'
  return 'ECOVENT Operations'
}

export function AppLayout() {
  const location = useLocation()
  const title = getPageTitle(location.pathname)
  const { collapsed, toggle } = useSidebarCollapsed()

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between gap-4 px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {collapsed && (
              <button
                type="button"
                onClick={toggle}
                className="p-2 rounded-md text-text-secondary hover:text-primary hover:bg-primary-muted transition-colors shrink-0"
                aria-label="Expand navigation"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-semibold truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background p-8">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
