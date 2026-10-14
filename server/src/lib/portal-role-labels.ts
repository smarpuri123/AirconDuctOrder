import { ROLE_DEFINITIONS } from './permissions.js'

export function portalRoleLabel(code: string): string {
  const def = ROLE_DEFINITIONS[code as keyof typeof ROLE_DEFINITIONS]
  return def?.name ?? code
}

export function portalRoleLabels(codes: string[]): string {
  if (!codes.length) return 'User'
  return codes.map(portalRoleLabel).join(', ')
}
