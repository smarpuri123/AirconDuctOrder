export type AssignablePortalUser = {
  userId: string
  employeeId: string
  name: string
  username: string
  phone: string | null
  roles: string[]
}

export type PortalUser = {
  id: string
  username: string
  email: string
  name: string
  phone: string | null
  active: boolean
  roles: string[]
  employeeId: string | null
  lastLoginAt: string | null
  createdAt: string
}

export const PORTAL_USER_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SALES', label: 'Sales' },
  { value: 'DESIGNER', label: 'Designer' },
  { value: 'ACCOUNTS', label: 'Accounts' },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'ADMIN', label: 'Administrator' },
]
