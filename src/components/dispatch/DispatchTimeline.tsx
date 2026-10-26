import { useNavigate } from 'react-router-dom'
import type { Dispatch, Order } from '@/types'
import { formatArea, formatDate } from '@/lib/calculations'
import { resolveDispatchAccessories } from '@/lib/dispatchAccessories'
import { DispatchStatusChip } from '@/components/ui/Chip'
import { Check, Package, Truck } from 'lucide-react'

interface DispatchTimelineProps {
  order: Order
  dispatches: Dispatch[]
}

export function DispatchTimeline({ order, dispatches }: DispatchTimelineProps) {
  const navigate = useNavigate()
  const events = [
    ...dispatches.map((d) => ({
      type: 'dispatch' as const,
      date: d.dispatchDate,
      createdAt: d.createdAt,
      dispatch: d,
    })),
    {
      type: 'created' as const,
      date: order.createdAt,
      createdAt: order.createdAt,
      order,
    },
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.type === 'dispatch' ? event.dispatch.id : 'created'} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                event.type === 'dispatch' ? 'bg-primary/10 text-primary' : 'bg-success-bg text-success'
              }`}
            >
              {event.type === 'dispatch' ? <Truck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            {i < events.length - 1 && <div className="w-0.5 flex-1 bg-border my-2" />}
          </div>

          <div className="pb-8 flex-1">
            {event.type === 'dispatch' ? (
              <div
                onClick={() => navigate(`/dispatch/${event.dispatch.id}`)}
                className="cursor-pointer hover:bg-background/60 rounded-lg p-2 -m-2 transition-colors"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold text-primary hover:underline">
                    {event.dispatch.dispatchNo}
                  </span>
                  <DispatchStatusChip status={event.dispatch.status} />
                </div>
                <p className="text-sm text-text-secondary">{formatDate(event.dispatch.dispatchDate)}</p>
                <p className="text-sm text-text-secondary">
                  Vehicle {event.dispatch.vehicle.vehicleNumber} · {event.dispatch.vehicle.driverName}
                </p>
                <p className="text-sm font-medium tabular-nums mt-2">
                  {event.dispatch.totalQuantity} Qty · {formatArea(event.dispatch.totalArea)}
                </p>
                {(() => {
                  const acc = resolveDispatchAccessories(event.dispatch, order)
                  const inc = [
                    acc.corner.included ? `CORNNER: ${acc.corner.quantity}` : null,
                    acc.nBolt.included ? `N/BOLT: ${acc.nBolt.quantity}` : null,
                    acc.cleat.included ? `CLEAT: ${acc.cleat.quantity}` : null,
                  ].filter(Boolean)
                  if (inc.length === 0) return null
                  return (
                    <p className="text-xs text-text-secondary mt-1 inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-success" />
                      Accessories: {inc.join(' · ')} NOS
                    </p>
                  )
                })()}
              </div>
            ) : (
              <>
                <p className="font-semibold">ORDER CREATED</p>
                <p className="text-sm text-text-secondary">{formatDate(event.order.createdAt)}</p>
                <p className="text-sm font-medium tabular-nums mt-2">
                  {event.order.totalQuantity} Qty · {formatArea(event.order.totalArea)}
                </p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
