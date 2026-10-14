import { prisma } from './prisma.js'

type EmployeeNameRow = {
  name: string
  user?: { name: string } | null
}

export function employeeDisplayNameFromRow(
  employee: EmployeeNameRow | null | undefined,
): string | undefined {
  if (!employee) return undefined
  const fromUser = employee.user?.name?.trim()
  if (fromUser) return fromUser
  return employee.name?.trim() || undefined
}

export async function employeeDisplayName(employeeId: string | null | undefined): Promise<string | undefined> {
  if (!employeeId) return undefined
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { select: { name: true } } },
  })
  return employeeDisplayNameFromRow(employee)
}

export async function jobRoleLabel(code: string | null | undefined): Promise<string | undefined> {
  if (!code?.trim()) return undefined
  const role = await prisma.jobRole.findUnique({ where: { code: code.trim() } })
  return role?.label ?? code
}
