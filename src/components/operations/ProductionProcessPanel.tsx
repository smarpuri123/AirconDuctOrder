import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/calculations'
import type { Order } from '@/types'
import {
  PRODUCTION_PROCESS_LABELS,
  type ProductionProcess,
  productionProcessesComplete,
} from '@/types/production'

type Props = {
  order: Order
  productionApproved: boolean
  inProduction: boolean
  onApproveProduction: () => void
  onCompleteProcess: (process: ProductionProcess) => void
  onMarkReady: () => void
  busyProcess?: ProductionProcess | null
}

function ProcessButton({
  process,
  completed,
  completedBy,
  completedAt,
  disabled,
  onClick,
}: {
  process: ProductionProcess
  completed: boolean
  completedBy?: string
  completedAt?: string
  disabled?: boolean
  onClick: () => void
}) {
  const label = PRODUCTION_PROCESS_LABELS[process]
  return (
    <div className="flex flex-col gap-1 min-w-[200px] flex-1">
      <Button
        type="button"
        variant={completed ? 'secondary' : 'primary'}
        className={completed ? 'border-success text-success' : ''}
        disabled={disabled || completed}
        onClick={onClick}
      >
        {completed ? (
          <>
            <Check className="w-4 h-4" />
            {label} — Done
          </>
        ) : (
          `Mark ${label} complete`
        )}
      </Button>
      {completed && (completedBy || completedAt) && (
        <p className="text-xs text-text-secondary">
          {completedBy ?? '—'}
          {completedAt ? ` · ${formatDate(completedAt.split('T')[0])}` : ''}
        </p>
      )}
    </div>
  )
}

export function ProductionProcessPanel({
  order,
  productionApproved,
  inProduction,
  onApproveProduction,
  onCompleteProcess,
  onMarkReady,
  busyProcess,
}: Props) {
  const bothDone = productionProcessesComplete(order)
  const showProcesses = inProduction && productionApproved

  return (
    <div className="mt-6 pt-6 border-t border-border space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm font-medium">Production approval</p>
        {productionApproved ? (
          <span className="text-sm text-success">
            Approved by {order.productionApprovedBy} ·{' '}
            {order.productionApprovedDate ? formatDate(order.productionApprovedDate) : '—'}
          </span>
        ) : (
          <Button size="sm" onClick={onApproveProduction}>Approve Production Start</Button>
        )}
      </div>

      {showProcesses && (
        <>
          <p className="text-sm text-text-secondary">
            Mark each shop-floor process when complete. No quantity tracking — dispatch still uses order
            line quantities.
          </p>
          <div className="flex flex-wrap gap-4">
            <ProcessButton
              process="straight_ducts"
              completed={Boolean(order.straightDuctsCompleted)}
              completedBy={order.straightDuctsCompletedBy}
              completedAt={order.straightDuctsCompletedAt}
              disabled={busyProcess === 'straight_ducts'}
              onClick={() => onCompleteProcess('straight_ducts')}
            />
            <ProcessButton
              process="plasma_ducts"
              completed={Boolean(order.plasmaDuctsCompleted)}
              completedBy={order.plasmaDuctsCompletedBy}
              completedAt={order.plasmaDuctsCompletedAt}
              disabled={busyProcess === 'plasma_ducts'}
              onClick={() => onCompleteProcess('plasma_ducts')}
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={onMarkReady} disabled={!bothDone}>
              Mark Ready for Dispatch
            </Button>
            {!bothDone && (
              <p className="text-xs text-text-secondary self-center">
                Complete both processes to release stock for dispatch.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
