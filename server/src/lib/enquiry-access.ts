import { prisma } from './prisma.js'
import type { AuthUser } from '../types/fastify.js'
import { APPROVAL_PROCESSING_STATUSES, DESIGN_STATUSES } from './design-workflow.js'
import type { Prisma } from '@prisma/client'

export function isDesignerOnlyUser(roles: string[]): boolean {
  if (roles.includes('ADMIN') || roles.includes('SUPERVISOR')) return false
  return roles.includes('DESIGNER')
}

export function isAccountsOnlyUser(roles: string[]): boolean {
  if (roles.includes('ADMIN') || roles.includes('SUPERVISOR')) return false
  const normalized = roles.map((r) => (r === 'DISPATCH' ? 'DISPATCHER' : r))
  return normalized.includes('ACCOUNTS') && !normalized.includes('DESIGNER')
}

export async function employeeIdForUser(userId: string): Promise<string | null> {
  const emp = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  })
  return emp?.id ?? null
}

export type EnquiryListScope =
  | { mode: 'all' }
  | { mode: 'assigned'; employeeId: string }
  | { mode: 'accounts_approval' }
  | { mode: 'none' }

/** @deprecated Use EnquiryListScope */
export type DesignerEnquiryListScope = EnquiryListScope

const DESIGNER_EXCLUDED_STATUSES = [
  ...APPROVAL_PROCESSING_STATUSES,
  DESIGN_STATUSES.APPROVED,
]

export async function resolveEnquiryListScope(user: AuthUser): Promise<EnquiryListScope> {
  if (isAccountsOnlyUser(user.roles)) {
    return { mode: 'accounts_approval' }
  }
  if (!isDesignerOnlyUser(user.roles)) return { mode: 'all' }
  const employeeId = await employeeIdForUser(user.id)
  if (!employeeId) return { mode: 'none' }
  return { mode: 'assigned', employeeId }
}

export async function resolveDesignerEnquiryListScope(user: AuthUser): Promise<EnquiryListScope> {
  return resolveEnquiryListScope(user)
}

function isAccountsApprovalRow(row: {
  designStatus: string
  customerOrderId: string | null
}): boolean {
  if (row.customerOrderId) return false
  return APPROVAL_PROCESSING_STATUSES.includes(
    row.designStatus as (typeof APPROVAL_PROCESSING_STATUSES)[number],
  )
}

function isDesignerAssignedRow(
  row: { currentAssigneeId: string | null; designStatus: string; customerOrderId: string | null },
  employeeId: string,
): boolean {
  if (row.currentAssigneeId !== employeeId) return false
  if (row.customerOrderId) return false
  return !DESIGNER_EXCLUDED_STATUSES.includes(
    row.designStatus as (typeof DESIGNER_EXCLUDED_STATUSES)[number],
  )
}

export async function canAccessEnquiryForUser(user: AuthUser, enquiryId: string): Promise<boolean> {
  const row = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: { currentAssigneeId: true, designStatus: true, customerOrderId: true },
  })
  if (!row) return false

  if (isAccountsOnlyUser(user.roles)) {
    return isAccountsApprovalRow(row)
  }

  const scope = await resolveEnquiryListScope(user)
  if (scope.mode === 'all') return true
  if (scope.mode === 'none') return false
  if (scope.mode === 'accounts_approval') return isAccountsApprovalRow(row)
  return isDesignerAssignedRow(row, scope.employeeId)
}

export function listScopeToPrismaWhere(scope: EnquiryListScope): Prisma.EnquiryWhereInput {
  if (scope.mode === 'accounts_approval') {
    return {
      customerOrderId: null,
      designStatus: { in: [...APPROVAL_PROCESSING_STATUSES] },
    }
  }
  if (scope.mode === 'assigned') {
    return {
      currentAssigneeId: scope.employeeId,
      customerOrderId: null,
      designStatus: { notIn: [...DESIGNER_EXCLUDED_STATUSES] },
    }
  }
  if (scope.mode === 'none') return { id: { in: [] } }
  return {}
}
