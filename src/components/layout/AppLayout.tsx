import { Outlet, useLocation } from 'react-router-dom'
import { UserMenu } from '@/components/layout/UserMenu'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Sidebar } from './Sidebar'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
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
  return 'ECOVENT Operations'
}

export function AppLayout() {
  const location = useLocation()
  const title = getPageTitle(location.pathname)

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between gap-4 px-8 shrink-0">
          <h1 className="text-xl font-semibold">{title}</h1>
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
