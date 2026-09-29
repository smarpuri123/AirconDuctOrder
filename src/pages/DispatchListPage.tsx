import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { dispatchService } from '@/services/dispatchService'
import { PageToolbar } from '@/components/layout/PageToolbar'
import { KanbanBoard } from '@/components/views/KanbanBoard'
import { formatArea, formatDate } from '@/lib/calculations'
import { Card } from '@/components/ui/Card'
import { DispatchStatusChip } from '@/components/ui/Chip'
import { useViewStore } from '@/store/viewStore'
import type { Dispatch } from '@/types'
import { DISPATCH_KANBAN_COLUMNS, normalizeDispatchStatus } from '@/lib/dispatchWorkflow'

export function DispatchListPage() {
  const navigate = useNavigate()
  const view = useViewStore((s) => s.preferences.dispatch)

  const dispatches = useMemo(
    () =>
      dispatchService
        .getDispatches()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [],
  )

  const open = (id: string) => navigate(`/dispatch/${id}`)

  return (
    <div className="space-y-6">
      <PageToolbar screen="dispatch" />

      <p className="text-text-secondary text-sm">{dispatches.length} dispatch trips recorded</p>

      {dispatches.length === 0 && (
        <p className="text-center text-text-secondary py-12">No dispatches yet.</p>
      )}

      {view === 'card' && dispatches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dispatches.map((d) => (
            <Card key={d.id} hover onClick={() => open(d.id)}>
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold">{d.dispatchNo}</p>
                <DispatchStatusChip status={d.status} />
              </div>
              <p className="text-sm text-text-secondary">{d.orderNo} · {d.customerName}</p>
              <p className="text-sm text-text-secondary">{formatDate(d.dispatchDate)} · {d.vehicle.vehicleNumber}</p>
              <p className="text-sm font-medium tabular-nums mt-2">{d.totalQuantity} Qty · {formatArea(d.totalArea)}</p>
            </Card>
          ))}
        </div>
      )}

      {view === 'grid' && dispatches.length > 0 && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-left">
                  <th className="py-3 px-3">Dispatch No</th>
                  <th className="py-3 px-3">Order</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Vehicle</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => open(d.id)}
                    className="border-b border-border hover:bg-background cursor-pointer"
                  >
                    <td className="py-3 px-3 font-medium">{d.dispatchNo}</td>
                    <td className="py-3 px-3">{d.orderNo}</td>
                    <td className="py-3 px-3">{d.customerName}</td>
                    <td className="py-3 px-3">{formatDate(d.dispatchDate)}</td>
                    <td className="py-3 px-3">{d.vehicle.vehicleNumber}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{d.totalQuantity}</td>
                    <td className="py-3 px-3"><DispatchStatusChip status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'kanban' && dispatches.length > 0 && (
        <KanbanBoard
          columns={DISPATCH_KANBAN_COLUMNS.map((col) => ({
            ...col,
            items: dispatches.filter((d) => normalizeDispatchStatus(d.status) === col.id),
          }))}
          getKey={(d) => d.id}
          onCardClick={(d) => open(d.id)}
          renderCard={(d: Dispatch) => (
            <>
              <p className="font-semibold text-sm">{d.dispatchNo}</p>
              <p className="text-xs text-text-secondary mt-1">{d.orderNo}</p>
              <p className="text-xs tabular-nums mt-2">{d.totalQuantity} Qty</p>
            </>
          )}
        />
      )}
    </div>
  )
}
