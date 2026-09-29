/** Application role codes (match server `roles.code`). */
export const PORTAL_ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  DESIGNER: 'DESIGNER',
  ACCOUNTS: 'ACCOUNTS',
  PRODUCTION: 'PRODUCTION',
  DISPATCHER: 'DISPATCHER',
} as const

export type PortalRole = (typeof PORTAL_ROLES)[keyof typeof PORTAL_ROLES]

export function hasAnyRole(roles: string[], allowed: PortalRole[]): boolean {
  if (roles.includes(PORTAL_ROLES.ADMIN)) return true
  const normalized = roles.map((r) => (r === 'DISPATCH' ? PORTAL_ROLES.DISPATCHER : r))
  return allowed.some((r) => normalized.includes(r))
}

/** Designer portal user without admin/supervisor oversight — list is assignee-scoped. */
export function isDesignerOnlyUser(roles: string[]): boolean {
  if (hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])) return false
  return roles.includes(PORTAL_ROLES.DESIGNER)
}

export function isDispatcherOnly(roles: string[]): boolean {
  const normalized = roles.map((r) => (r === 'DISPATCH' ? PORTAL_ROLES.DISPATCHER : r))
  return normalized.includes(PORTAL_ROLES.DISPATCHER) && normalized.length === 1
}

export function defaultPortalPath(roles: string[]): string {
  if (isDispatcherOnly(roles)) return '/m/orders'
  if (hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])) return '/'
  if (hasAnyRole(roles, [PORTAL_ROLES.DESIGNER, PORTAL_ROLES.ACCOUNTS])) return '/enquiries'
  if (hasAnyRole(roles, [PORTAL_ROLES.PRODUCTION])) return '/orders'
  return '/enquiries'
}

export function canAccessDashboard(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])
}

export function canAccessClients(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])
}

export function canAccessEnquiries(roles: string[]): boolean {
  return hasAnyRole(roles, [
    PORTAL_ROLES.ADMIN,
    PORTAL_ROLES.SUPERVISOR,
    PORTAL_ROLES.DESIGNER,
    PORTAL_ROLES.ACCOUNTS,
    PORTAL_ROLES.PRODUCTION,
  ])
}

export function canCreateEnquiry(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])
}

export function canAccessDesignImport(roles: string[]): boolean {
  return hasAnyRole(roles, [
    PORTAL_ROLES.ADMIN,
    PORTAL_ROLES.SUPERVISOR,
    PORTAL_ROLES.DESIGNER,
  ])
}

export function canAccessOrders(roles: string[]): boolean {
  return hasAnyRole(roles, [
    PORTAL_ROLES.ADMIN,
    PORTAL_ROLES.SUPERVISOR,
    PORTAL_ROLES.PRODUCTION,
    PORTAL_ROLES.DISPATCHER,
  ])
}

export function canAccessDispatchList(roles: string[]): boolean {
  return hasAnyRole(roles, [
    PORTAL_ROLES.ADMIN,
    PORTAL_ROLES.SUPERVISOR,
    PORTAL_ROLES.DISPATCHER,
  ])
}

export function canAccessSettings(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])
}

/** Full activity timeline + workflow summary on enquiry detail. */
export function canSeeWorkflowAuditLog(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])
}

export function canManageEnquiryIntake(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])
}

export function canManageDesignWorkflow(roles: string[]): boolean {
  return hasAnyRole(roles, [
    PORTAL_ROLES.ADMIN,
    PORTAL_ROLES.SUPERVISOR,
    PORTAL_ROLES.DESIGNER,
  ])
}

export function canManageAccountsWorkflow(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR, PORTAL_ROLES.ACCOUNTS])
}

export function canManageProductionOnEnquiry(roles: string[]): boolean {
  return hasAnyRole(roles, [
    PORTAL_ROLES.ADMIN,
    PORTAL_ROLES.SUPERVISOR,
    PORTAL_ROLES.PRODUCTION,
  ])
}

export function canUploadClientInputFiles(roles: string[]): boolean {
  return hasAnyRole(roles, [PORTAL_ROLES.ADMIN, PORTAL_ROLES.SUPERVISOR])
}

export type PortalNavItem = {
  to: string
  label: string
  badgeKey: 'dashboard' | 'enquiries' | 'orders' | 'dispatch' | null
  end?: boolean
}

export function portalNavItemsForRoles(roles: string[]): PortalNavItem[] {
  const items: PortalNavItem[] = []
  if (canAccessDashboard(roles)) {
    items.push({ to: '/', label: 'Dashboard', badgeKey: 'dashboard', end: true })
  }
  if (canAccessClients(roles)) {
    items.push({ to: '/clients', label: 'Clients', badgeKey: null })
  }
  if (canAccessEnquiries(roles)) {
    items.push({ to: '/enquiries', label: 'Enquiries', badgeKey: 'enquiries' })
  }
  if (canAccessOrders(roles)) {
    items.push({ to: '/orders', label: 'Orders', badgeKey: 'orders' })
  }
  if (canAccessDispatchList(roles)) {
    items.push({ to: '/dispatch', label: 'Dispatch', badgeKey: 'dispatch' })
  }
  if (canAccessSettings(roles)) {
    items.push({ to: '/settings', label: 'Settings', badgeKey: null })
  }
  return items
}

export function canAccessPortalPath(roles: string[], pathname: string): boolean {
  if (pathname === '/' || pathname === '') return canAccessDashboard(roles)
  if (pathname.startsWith('/clients')) return canAccessClients(roles)
  if (pathname === '/enquiries/new') return canCreateEnquiry(roles)
  if (pathname.startsWith('/enquiries/') && pathname.includes('/design/import')) {
    return canAccessDesignImport(roles)
  }
  if (pathname.startsWith('/enquiries')) return canAccessEnquiries(roles)
  if (pathname.startsWith('/orders')) return canAccessOrders(roles)
  if (pathname.startsWith('/dispatch')) return canAccessDispatchList(roles)
  if (pathname.startsWith('/settings')) return canAccessSettings(roles)
  return true
}

/** Demo mode: map acting-as label to API role codes. */
export function demoActorRoleToPortalRoles(actorRoleLabel: string): string[] {
  const normalized = actorRoleLabel.toLowerCase()
  if (normalized.includes('admin')) return [PORTAL_ROLES.ADMIN]
  if (normalized.includes('supervisor')) return [PORTAL_ROLES.SUPERVISOR]
  if (normalized.includes('design')) return [PORTAL_ROLES.DESIGNER]
  if (normalized.includes('account')) return [PORTAL_ROLES.ACCOUNTS]
  if (normalized.includes('production')) return [PORTAL_ROLES.PRODUCTION]
  if (normalized.includes('dispatch')) return [PORTAL_ROLES.DISPATCHER]
  if (normalized.includes('sales')) return [PORTAL_ROLES.SUPERVISOR]
  return [PORTAL_ROLES.SUPERVISOR]
}
