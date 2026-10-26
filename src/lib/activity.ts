import { getTodayISO } from '@/lib/calculations'
import type { ActivityEntry, ActivityPhase } from '@/types/enquiry'

export interface CreateActivityInput {
  phase: ActivityPhase
  title: string
  detail?: string
  actor: string
  actorRole?: string
  revision?: number
  metadata?: ActivityEntry['metadata']
}

export function createActivityEntry(input: CreateActivityInput): ActivityEntry {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    phase: input.phase,
    title: input.title,
    detail: input.detail,
    actor: input.actor,
    actorRole: input.actorRole,
    revision: input.revision,
    metadata: input.metadata,
  }
}

export function isAccountsActivityTitle(title: string): boolean {
  return /^(quote\s+(submitted|approved|document)|po\s+(sent|pending|approved)|design\s*&\s*po\s+approved|workflow step back)/i.test(
    title.trim(),
  )
}

function inferPhase(text: string): ActivityPhase {
  const lower = text.toLowerCase()
  if (lower.includes('dispatch')) return 'dispatch'
  if (lower.includes('production') || lower.includes('manufactur') || lower.includes('ready for dispatch')) {
    return 'production'
  }
  if (lower.includes('order') || lower.includes('converted')) return 'order'
  if (isAccountsActivityTitle(text) || lower.includes('quote')) return 'accounts'
  if (lower.includes('design') || lower.includes('duct') || lower.includes('drawing')) return 'design'
  return 'enquiry'
}

export function resolveActivityPhase(
  phase: ActivityPhase | undefined,
  title: string,
): ActivityPhase {
  if ((!phase || phase === 'design') && isAccountsActivityTitle(title)) {
    return 'accounts'
  }
  return phase ?? inferPhase(title)
}

export function normalizeActivityEntry(entry: ActivityEntry): ActivityEntry {
  if (entry.timestamp && entry.phase && entry.actor && entry.title) {
    const resolvedPhase = resolveActivityPhase(entry.phase, entry.title)
    return resolvedPhase === entry.phase ? entry : { ...entry, phase: resolvedPhase }
  }

  const legacyTitle = entry.title ?? entry.action ?? 'Update'
  const legacyDate = entry.timestamp ?? entry.date ?? getTodayISO()

  return {
    id: entry.id,
    timestamp: legacyDate.includes('T') ? legacyDate : `${legacyDate}T12:00:00.000Z`,
    phase: resolveActivityPhase(entry.phase, legacyTitle),
    title: legacyTitle,
    detail: entry.detail,
    actor: entry.actor ?? 'System',
    actorRole: entry.actorRole,
    revision: entry.revision,
    metadata: entry.metadata,
  }
}

export const PHASE_LABELS: Record<ActivityPhase, string> = {
  enquiry: 'Enquiry',
  design: 'Design',
  accounts: 'Accounts',
  order: 'Order',
  production: 'Production',
  dispatch: 'Dispatch',
}
