import type { Employee } from '@/types/org'

export function jobRoleCodeLabel(
  code: string | null | undefined,
  employees: Employee[] = [],
): string {
  if (!code?.trim()) return ''
  for (const employee of employees) {
    const match = employee.jobRoles.find((role) => role.code === code)
    if (match?.label) return match.label
  }
  return code.replace(/_/g, ' ')
}
