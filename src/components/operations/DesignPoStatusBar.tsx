import type { DesignReviewStatus } from '@/types/enquiry'

const STEPS: { status: DesignReviewStatus; label: string }[] = [
  { status: 'in_review', label: 'Design extraction' },
  { status: 'submitted_to_accounts', label: 'With accounts' },
  { status: 'po_for_review', label: 'PO for review' },
  { status: 'po_for_approval', label: 'PO for approval' },
  { status: 'approved', label: 'Approved' },
]

function stepIndex(status: DesignReviewStatus): number {
  if (status === 'pending' || status === 'revision_needed') return 0
  const idx = STEPS.findIndex((s) => s.status === status)
  return idx >= 0 ? idx : 0
}

export function designStatusLabel(status: DesignReviewStatus): string {
  const found = STEPS.find((s) => s.status === status)
  if (found) return found.label
  const map: Record<string, string> = {
    pending: 'Pending',
    revision_needed: 'Revision needed',
  }
  return map[status] ?? status
}

export function DesignPoStatusBar({ status }: { status: DesignReviewStatus }) {
  if (status === 'pending') return null

  const active = stepIndex(status)
  const isRevision = status === 'revision_needed'

  return (
    <div className="mb-5">
      {isRevision && (
        <p className="text-sm text-warning font-medium mb-2">Revision in progress — update extraction then resubmit</p>
      )}
      <ol className="flex flex-wrap gap-1 sm:gap-0 sm:flex-nowrap items-center text-xs sm:text-sm">
        {STEPS.map((step, i) => {
          const done = !isRevision && i < active
          const current = !isRevision && i === active
          return (
            <li key={step.status} className="flex items-center min-w-0">
              <span
                className={`px-2 py-1 rounded-md truncate max-w-[7.5rem] sm:max-w-none ${
                  current
                    ? 'bg-primary text-white font-medium'
                    : done
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'bg-background text-text-secondary border border-border'
                }`}
              >
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="hidden sm:inline text-text-secondary mx-1" aria-hidden>→</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
