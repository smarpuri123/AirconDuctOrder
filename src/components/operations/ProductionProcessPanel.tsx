import { useEffect, useState } from 'react'
import { Check, Pause, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/calculations'
import type { Order } from '@/types'
import {
  formatProductionActiveTime,
  getProductionTrackActiveSeconds,
  getProductionTrackStatus,
  PRODUCTION_TRACK_STATUS_LABELS,
  type ProductionTrackAction,
  type ProductionTrackStatus,
} from '@/lib/productionTrack'
import {
  PRODUCTION_PROCESS_LABELS,
  type ProductionProcess,
  productionProcessesComplete,
} from '@/types/production'

type Props = {
  order: Order
  inProduction: boolean
  onTrackAction: (process: ProductionProcess, action: ProductionTrackAction) => void
  onMarkReady: () => void
  busyProcess?: ProductionProcess | null
}

function statusVariant(status: ProductionTrackStatus): string {
  switch (status) {
    case 'running':
      return 'bg-success/15 text-success border-success/30'
    case 'paused':
      return 'bg-warning/15 text-warning border-warning/30'
    case 'completed':
      return 'bg-surface text-text-secondary border-border'
    default:
      return 'bg-background text-text-secondary border-border'
  }
}

function ProductionTrackCard({
  order,
  process,
  disabled,
  busy,
  onAction,
}: {
  order: Order
  process: ProductionProcess
  disabled?: boolean
  busy?: boolean
  onAction: (action: ProductionTrackAction) => void
}) {
  const [tick, setTick] = useState(0)
  const status = getProductionTrackStatus(order, process)
  const label = PRODUCTION_PROCESS_LABELS[process]

  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [status])

  const activeSeconds = getProductionTrackActiveSeconds(order, process, new Date())
  const completedAt =
    process === 'straight_ducts' ? order.straightDuctsCompletedAt : order.plasmaDuctsCompletedAt
  const completedBy =
    process === 'straight_ducts' ? order.straightDuctsCompletedBy : order.plasmaDuctsCompletedBy

  return (
    <div className="flex-1 min-w-[240px] rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-xs text-text-secondary mt-0.5">Work center · one active order at a time</p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${statusVariant(status)}`}
        >
          {PRODUCTION_TRACK_STATUS_LABELS[status]}
        </span>
      </div>

      <div>
        <p className="text-xs text-text-secondary">Active production time</p>
        <p className="text-2xl font-bold tabular-nums tracking-tight">
          {formatProductionActiveTime(activeSeconds)}
        </p>
        {status === 'running' && (
          <p className="text-xs text-text-secondary">Timer running · pause when work is diverted</p>
        )}
      </div>

      {status === 'completed' && (completedBy || completedAt) && (
        <p className="text-xs text-text-secondary">
          {completedBy ?? '—'}
          {completedAt ? ` · ${formatDate(completedAt.split('T')[0])}` : ''}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'not_started' && (
          <Button type="button" size="sm" disabled={disabled || busy} onClick={() => onAction('start')}>
            <Play className="w-4 h-4" />
            Start
          </Button>
        )}
        {status === 'running' && (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || busy}
              onClick={() => onAction('pause')}
            >
              <Pause className="w-4 h-4" />
              Pause
            </Button>
            <Button type="button" size="sm" disabled={disabled || busy} onClick={() => onAction('complete')}>
              <Check className="w-4 h-4" />
              Complete
            </Button>
          </>
        )}
        {status === 'paused' && (
          <>
            <Button type="button" size="sm" disabled={disabled || busy} onClick={() => onAction('resume')}>
              <Play className="w-4 h-4" />
              Resume
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || busy}
              onClick={() => onAction('complete')}
            >
              <Check className="w-4 h-4" />
              Complete
            </Button>
          </>
        )}
        {status === 'completed' && (
          <Button type="button" size="sm" variant="secondary" disabled className="border-success text-success">
            <Check className="w-4 h-4" />
            Done
          </Button>
        )}
      </div>
      {/* tick forces re-render for live timer */}
      <span className="sr-only" aria-hidden>{tick}</span>
    </div>
  )
}

export function ProductionProcessPanel({
  order,
  inProduction,
  onTrackAction,
  onMarkReady,
  busyProcess,
}: Props) {
  const bothDone = productionProcessesComplete(order)
  const showTracks = inProduction

  return (
    <div className="mt-6 pt-6 border-t border-border space-y-4">
      <div>
        <p className="text-sm font-medium">Shop floor production</p>
        <p className="text-sm text-text-secondary mt-1">
          Start straight duct and plasma (round) work independently. Pausing stops the timer — use
          when switching to an urgent order or moving manpower. Starting another order on the same
          line auto-pauses the current one.
        </p>
      </div>

      {showTracks ? (
        <>
          <div className="flex flex-wrap gap-4">
            <ProductionTrackCard
              order={order}
              process="straight_ducts"
              busy={busyProcess === 'straight_ducts'}
              onAction={(action) => onTrackAction('straight_ducts', action)}
            />
            <ProductionTrackCard
              order={order}
              process="plasma_ducts"
              busy={busyProcess === 'plasma_ducts'}
              onAction={(action) => onTrackAction('plasma_ducts', action)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            <Button onClick={onMarkReady} disabled={!bothDone}>
              <Square className="w-4 h-4" />
              Mark ready for dispatch
            </Button>
            {!bothDone && (
              <p className="text-xs text-text-secondary">
                Complete both lines before releasing stock for dispatch.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-secondary">Order is not in production status.</p>
      )}
    </div>
  )
}
