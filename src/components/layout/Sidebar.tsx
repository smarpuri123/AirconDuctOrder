import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Truck, Settings, Wind, FileText, Building2 } from 'lucide-react'
import { useApiData } from '@/hooks/useApiData'
import { usePortalRoles } from '@/hooks/usePortalRoles'
import { portalNavItemsForRoles } from '@/lib/portalAccess'
import { computeWorkQueueSnapshot, sidebarBadgesForRoles } from '@/lib/workQueue'
import { NavBadge } from './NavBadge'

const navIcons = {
  Dashboard: LayoutDashboard,
  Clients: Building2,
  Enquiries: FileText,
  Orders: ClipboardList,
  Dispatch: Truck,
  Settings: Settings,
} as const

export function Sidebar() {
  const dataTick = useApiData()
  const roles = usePortalRoles()
  const navItems = useMemo(() => portalNavItemsForRoles(roles), [roles])

  const badges = useMemo(() => {
    const snapshot = computeWorkQueueSnapshot()
    return sidebarBadgesForRoles(snapshot, roles)
  }, [dataTick, roles])

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-full min-h-0 shrink-0">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center ring-2 ring-secondary/40">
          <Wind className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-primary leading-tight">ECOVENT</p>
          <p className="text-[10px] text-text-secondary leading-tight">Operations</p>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(({ to, label, end, badgeKey }) => {
          const Icon = navIcons[label as keyof typeof navIcons] ?? FileText
          const count = badgeKey ? badges[badgeKey] : 0
          return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-primary hover:bg-primary-muted hover:text-primary'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="truncate">{label}</span>
            {badgeKey && (
              <NavBadge count={count} />
            )}
          </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border shrink-0">
        <p className="text-xs text-text-secondary text-center">Enquiry → Dispatch</p>
      </div>
    </aside>
  )
}
