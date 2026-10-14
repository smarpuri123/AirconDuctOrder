/** Default internal job role when provisioning an employee for a portal login role. */
export const PORTAL_ROLE_TO_JOB_ROLE: Record<string, string> = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SALES_LEAD',
  SALES: 'SALES_EXEC',
  DESIGNER: 'DESIGN_ENGINEER',
  ACCOUNTS: 'ACCOUNTS',
  PRODUCTION: 'PRODUCTION_INCHARGE',
  DISPATCHER: 'DISPATCHER',
  DISPATCH: 'DISPATCHER',
}

export const ASSIGNABLE_PORTAL_ROLES = [
  'SUPERVISOR',
  'SALES',
  'DESIGNER',
  'ACCOUNTS',
  'PRODUCTION',
  'DISPATCHER',
  'ADMIN',
] as const

/** Portal roles whose linked users may be picked at each workflow stage. */
export const STAGE_PORTAL_ROLES: Record<string, readonly string[]> = {
  enquiry: ['ADMIN', 'SUPERVISOR', 'SALES'],
  design_review: ['ADMIN', 'SUPERVISOR', 'DESIGNER'],
  order: ['ADMIN', 'SUPERVISOR', 'ACCOUNTS', 'SALES', 'DESIGNER'],
  manufacturing: ['ADMIN', 'SUPERVISOR', 'PRODUCTION'],
  dispatch: ['ADMIN', 'SUPERVISOR', 'DISPATCHER'],
}
