import { PHASE_LABELS, resolveActivityPhase } from '@/lib/activity'
import type { ActivityEntry, ActivityPhase } from '@/types/enquiry'

const PHASE_ORDER: ActivityPhase[] = [
  'enquiry',
  'design',
  'accounts',
  'order',
  'production',
  'dispatch',
]

const PHASE_COLORS: Record<ActivityPhase, string> = {
  enquiry: 'border-primary',
  design: 'border-primary-light',
  accounts: 'border-teal-500',
  order: 'border-secondary',
  production: 'border-secondary-light',
  dispatch: 'border-brand-green',
}

function latestByPhase(entries: ActivityEntry[]): Partial<Record<ActivityPhase, ActivityEntry>> {
  const map: Partial<Record<ActivityPhase, ActivityEntry>> = {}
  for (const raw of entries) {
    const phase = resolveActivityPhase(raw.phase, raw.title)
    if (!map[phase]) {
      map[phase] = { ...raw, phase }
    }
  }
  return map
}

export function WorkflowProgressSummary({ entries }: { entries: ActivityEntry[] }) {
  const latest = latestByPhase(entries)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {PHASE_ORDER.map((phase) => {
        const entry = latest[phase]
        return (
          <div
            key={phase}
            className={`rounded-lg border-l-4 ${PHASE_COLORS[phase]} bg-background p-3 min-h-[88px]`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-1">
              {PHASE_LABELS[phase]}
            </p>
            {entry ? (
              <>
                <p className="text-sm font-medium leading-snug line-clamp-2">{entry.title}</p>
                <p className="text-xs text-text-secondary mt-1 truncate">{entry.actor}</p>
              </>
            ) : (
              <p className="text-xs text-text-secondary">Not started</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
