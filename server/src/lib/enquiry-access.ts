import { prisma } from './prisma.js'
import type { AuthUser } from '../types/fastify.js'

export function isDesignerOnlyUser(roles: string[]): boolean {
  if (roles.includes('ADMIN') || roles.includes('SUPERVISOR')) return false
  return roles.includes('DESIGNER')
}

export async function employeeIdForUser(userId: string): Promise<string | null> {
  const emp = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  })
  return emp?.id ?? null
}

export type DesignerEnquiryListScope =
  | { mode: 'all' }
  | { mode: 'assigned'; employeeId: string }
  | { mode: 'none' }

export async function resolveDesignerEnquiryListScope(user: AuthUser): Promise<DesignerEnquiryListScope> {
  if (!isDesignerOnlyUser(user.roles)) return { mode: 'all' }
  const employeeId = await employeeIdForUser(user.id)
  if (!employeeId) return { mode: 'none' }
  return { mode: 'assigned', employeeId }
}

export async function canAccessEnquiryForUser(user: AuthUser, enquiryId: string): Promise<boolean> {
  const scope = await resolveDesignerEnquiryListScope(user)
  if (scope.mode === 'all') return true
  if (scope.mode === 'none') return false

  const row = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: { currentAssigneeId: true },
  })
  return row?.currentAssigneeId === scope.employeeId
}

export function listScopeToPrismaWhere(
  scope: DesignerEnquiryListScope,
): { currentAssigneeId: string } | { id: { in: string[] } } | Record<string, never> {
  if (scope.mode === 'assigned') return { currentAssigneeId: scope.employeeId }
  if (scope.mode === 'none') return { id: { in: [] } }
  return {}
}
