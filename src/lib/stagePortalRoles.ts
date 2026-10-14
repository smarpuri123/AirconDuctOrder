/** Mirror of server STAGE_PORTAL_ROLES for client-side labels and filtering. */
export const STAGE_PORTAL_ROLES: Record<string, readonly string[]> = {
  enquiry: ['ADMIN', 'SUPERVISOR', 'SALES'],
  design_review: ['ADMIN', 'SUPERVISOR', 'DESIGNER'],
  order: ['ADMIN', 'SUPERVISOR', 'ACCOUNTS', 'SALES', 'DESIGNER'],
  manufacturing: ['ADMIN', 'SUPERVISOR', 'PRODUCTION'],
  dispatch: ['ADMIN', 'SUPERVISOR', 'DISPATCHER'],
}

export const PORTAL_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  SUPERVISOR: 'Supervisor',
  SALES: 'Sales',
  DESIGNER: 'Designer',
  ACCOUNTS: 'Accounts',
  PRODUCTION: 'Production',
  DISPATCHER: 'Dispatcher',
}
