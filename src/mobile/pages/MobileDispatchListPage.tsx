import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { dispatchService } from '@/services/dispatchService'
import { useApiData } from '@/hooks/useApiData'
import { formatArea, formatDate } from '@/lib/calculations'
import { DispatchStatusChip } from '@/components/ui/Chip'

export function MobileDispatchListPage() {
  const navigate = useNavigate()
  const dataTick = useApiData()

  const dispatches = useMemo(
    () =>
      dispatchService
        .getDispatches()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [dataTick],
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Dispatches</h2>
        <p className="text-sm text-text-secondary">{dispatches.length} trips recorded</p>
      </div>

      {dispatches.length === 0 && (
        <p className="text-center text-text-secondary py-12">No dispatches yet.</p>
      )}

      <ul className="space-y-3">
        {dispatches.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => navigate(`/m/dispatches/${d.id}`)}
              className="w-full text-left bg-surface rounded-xl border border-border p-4 touch-manipulation active:bg-background shadow-level-1"
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <p className="font-bold text-lg">{d.dispatchNo}</p>
                <DispatchStatusChip status={d.status} />
              </div>
              <p className="text-sm text-text-secondary">{d.orderNo} · {d.customerName}</p>
              <p className="text-sm text-text-secondary mt-1">
                {formatDate(d.dispatchDate)} · {d.vehicle.vehicleNumber}
              </p>
              <p className="text-sm font-bold tabular-nums mt-2">
                {d.totalQuantity} qty · {formatArea(d.totalArea)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
