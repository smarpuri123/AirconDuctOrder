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

function inferPhase(text: string): ActivityPhase {
  const lower = text.toLowerCase()
  if (lower.includes('dispatch')) return 'dispatch'
  if (lower.includes('production') || lower.includes('manufactur') || lower.includes('ready for dispatch')) {
    return 'production'
  }
  if (lower.includes('order') || lower.includes('converted')) return 'order'
  if (lower.includes('design') || lower.includes('duct') || lower.includes('drawing')) return 'design'
  return 'enquiry'
}

export function normalizeActivityEntry(entry: ActivityEntry): ActivityEntry {
  if (entry.timestamp && entry.phase && entry.actor && entry.title) {
    return entry
  }

  const legacyTitle = entry.title ?? entry.action ?? 'Update'
  const legacyDate = entry.timestamp ?? entry.date ?? getTodayISO()

  return {
    id: entry.id,
    timestamp: legacyDate.includes('T') ? legacyDate : `${legacyDate}T12:00:00.000Z`,
    phase: entry.phase ?? inferPhase(legacyTitle),
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
  order: 'Order',
  production: 'Production',
  dispatch: 'Dispatch',
}
