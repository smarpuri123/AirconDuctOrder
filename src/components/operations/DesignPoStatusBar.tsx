import type { DesignReviewStatus, Enquiry } from '@/types/enquiry'
import { APPROVAL_PROCESSING_STATUSES } from '@/lib/enquiryWorkflow'

const PO_STEPS: { status: DesignReviewStatus; label: string }[] = [
  { status: 'in_review', label: 'Working on design' },
  { status: 'submitted_to_accounts', label: 'Quote preparation' },
  { status: 'po_for_review', label: 'Quote review' },
  { status: 'po_approved', label: 'Quote approved (Supervisor)' },
  { status: 'po_for_approval', label: 'Quote submitted to client' },
  { status: 'approved', label: 'Quote approved (Order created)' },
]

function poStepIndex(status: DesignReviewStatus): number {
  if (status === 'pending' || status === 'revision_needed') return 0
  const idx = PO_STEPS.findIndex((s) => s.status === status)
  return idx >= 0 ? idx : 0
}

export function designStatusLabel(status: DesignReviewStatus): string {
  const map: Record<string, string> = {
    pending: 'Awaiting design start',
    in_review: 'Working on design',
    revision_needed: 'Revision needed',
    submitted_to_accounts: 'Quote preparation',
    po_for_review: 'Quote review',
    po_approved: 'Quote approved (Supervisor)',
    po_for_approval: 'Quote submitted to client',
    approved: 'Quote approved (Order created)',
  }
  return map[status] ?? status
}

function hasDuctSchedule(enquiry: Enquiry): boolean {
  return (enquiry.ductLines?.length ?? 0) > 0
}

/** Steps before accounts: start work → import Excel → submit. */
export function DesignDesignerProgress({ enquiry }: { enquiry: Enquiry }) {
  const status = enquiry.designReview.status
  if (APPROVAL_PROCESSING_STATUSES.includes(status) || status === 'approved') return null

  const started = status !== 'pending'
  const imported = hasDuctSchedule(enquiry)
  const steps = [
    { key: 'start', label: 'Start design work', done: started },
    { key: 'import', label: 'Import schedule (Excel)', done: imported },
    {
      key: 'submit',
      label: 'Submit to accounts',
      done: false,
      current: started && imported && status === 'in_review',
    },
  ]

  let activeIndex = 0
  if (!started) activeIndex = 0
  else if (!imported) activeIndex = 1
  else if (status === 'in_review') activeIndex = 2
  else activeIndex = 1

  return (
    <div className="mb-5">
      {status === 'revision_needed' && (
        <p className="text-sm text-warning font-medium mb-2">
          Revision in progress — start work, re-import schedule, then submit again
        </p>
      )}
      <ol className="flex flex-wrap gap-1 sm:gap-0 sm:flex-nowrap items-center text-xs sm:text-sm">
        {steps.map((step, i) => {
          const done = step.done
          const current = i === activeIndex && !done
          return (
            <li key={step.key} className="flex items-center min-w-0">
              <span
                className={`px-2 py-1 rounded-md truncate max-w-[8.5rem] sm:max-w-none ${
                  current
                    ? 'bg-primary text-white font-medium'
                    : done
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'bg-background text-text-secondary border border-border'
                }`}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <span className="hidden sm:inline text-text-secondary mx-1" aria-hidden>→</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function DesignPoStatusBar({ status }: { status: DesignReviewStatus }) {
  if (status === 'pending') return null

  const active = poStepIndex(status)
  const isRevision = status === 'revision_needed'

  return (
    <div className="mb-5">
      {isRevision && (
        <p className="text-sm text-warning font-medium mb-2">
          Revision in progress — update extraction then resubmit
        </p>
      )}
      <ol className="flex flex-wrap gap-1 sm:gap-0 sm:flex-nowrap items-center text-xs sm:text-sm">
        {PO_STEPS.map((step, i) => {
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
              {i < PO_STEPS.length - 1 && (
                <span className="hidden sm:inline text-text-secondary mx-1" aria-hidden>→</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
