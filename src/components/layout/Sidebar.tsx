import { useMemo } from 'react'

import { NavLink } from 'react-router-dom'

import {

  LayoutDashboard,

  ClipboardList,

  Truck,

  Settings,

  Wind,

  FileText,

  Building2,

  GitBranch,

  PanelLeftClose,

  PanelLeft,

} from 'lucide-react'

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

  Workshop: GitBranch,

} as const



type Props = {

  collapsed: boolean

  onToggleCollapsed: () => void

}



export function Sidebar({ collapsed, onToggleCollapsed }: Props) {

  const dataTick = useApiData()

  const roles = usePortalRoles()

  const navItems = useMemo(() => portalNavItemsForRoles(roles), [roles])



  const badges = useMemo(() => {

    const snapshot = computeWorkQueueSnapshot()

    return sidebarBadgesForRoles(snapshot, roles)

  }, [dataTick, roles])



  return (

    <aside

      className={`bg-surface border-r border-border flex flex-col h-full min-h-0 shrink-0 transition-[width] duration-200 ease-out ${

        collapsed ? 'w-[4.25rem]' : 'w-64'

      }`}

    >

      <div

        className={`h-16 flex items-center border-b border-border shrink-0 ${

          collapsed ? 'justify-center px-2' : 'gap-3 px-6'

        }`}

      >

        <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center ring-2 ring-secondary/40 shrink-0">

          <Wind className="w-5 h-5 text-white" />

        </div>

        {!collapsed && (

          <div className="min-w-0">

            <p className="font-bold text-sm text-primary leading-tight">ECOVENT</p>

            <p className="text-[10px] text-text-secondary leading-tight">Operations</p>

          </div>

        )}

      </div>



      <nav className={`flex-1 min-h-0 overflow-y-auto py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>

        {navItems.map(({ to, label, end, badgeKey }) => {

          const Icon = navIcons[label as keyof typeof navIcons] ?? FileText

          const count = badgeKey ? badges[badgeKey] : 0

          return (

            <NavLink

              key={to}

              to={to}

              end={end}

              title={collapsed ? label : undefined}

              className={({ isActive }) =>

                `flex items-center rounded-md text-sm font-medium transition-colors ${

                  collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'

                } ${

                  isActive

                    ? 'bg-primary text-white shadow-sm'

                    : 'text-text-primary hover:bg-primary-muted hover:text-primary'

                }`

              }

            >

              <span className="relative shrink-0">

                <Icon className="w-5 h-5" />

                {collapsed && count > 0 && (

                  <span

                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface"

                    aria-hidden

                  />

                )}

              </span>

              {!collapsed && <span className="truncate">{label}</span>}

              {!collapsed && badgeKey && <NavBadge count={count} />}

            </NavLink>

          )

        })}

      </nav>



      <div className={`border-t border-border shrink-0 ${collapsed ? 'p-2' : 'p-4'}`}>

        <button

          type="button"

          onClick={onToggleCollapsed}

          className={`flex items-center w-full rounded-md text-text-secondary hover:text-primary hover:bg-primary-muted transition-colors ${

            collapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2 text-sm'

          }`}

          aria-expanded={!collapsed}

          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}

        >

          {collapsed ? (

            <PanelLeft className="w-5 h-5 shrink-0" />

          ) : (

            <>

              <PanelLeftClose className="w-5 h-5 shrink-0" />

              <span>Collapse menu</span>

            </>

          )}

        </button>

        {!collapsed && (

          <p className="text-xs text-text-secondary text-center mt-3">Enquiry → Dispatch</p>

        )}

      </div>

    </aside>

  )

}


