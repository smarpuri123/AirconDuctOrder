import { useNavigate, useParams } from 'react-router-dom'
import { useApiData } from '@/hooks/useApiData'
import { ArrowLeft, Truck } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { getOrderBalanceQty, getOrderDispatchedQty, formatDate } from '@/lib/calculations'
import { DispatchStatusChip } from '@/components/ui/Chip'

export function MobileOrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useApiData()
  const order = orderService.getOrderById(id!)
  const trips = order ? dispatchService.getDispatchesByOrderId(order.id) : []

  if (!order) {
    return <p className="text-text-secondary">Order not found.</p>
  }

  const balance = getOrderBalanceQty(order)
  const canDispatch = balance > 0 && order.status !== 'production'

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate('/m/orders')}
        className="flex items-center gap-2 text-text-secondary min-h-11 touch-manipulation"
      >
        <ArrowLeft className="w-5 h-5" />
        Orders
      </button>

      <div>
        <h2 className="text-2xl font-bold">{order.orderNo}</h2>
        <p className="text-text-secondary">{order.customerName}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-surface rounded-xl p-3 border border-border">
          <p className="text-xs text-text-secondary">Total</p>
          <p className="text-xl font-bold tabular-nums">{order.totalQuantity}</p>
        </div>
        <div className="bg-surface rounded-xl p-3 border border-border">
          <p className="text-xs text-text-secondary">Dispatched</p>
          <p className="text-xl font-bold tabular-nums text-success">{getOrderDispatchedQty(order)}</p>
        </div>
        <div className="bg-surface rounded-xl p-3 border border-border">
          <p className="text-xs text-text-secondary">Balance</p>
          <p className="text-xl font-bold tabular-nums text-warning">{balance}</p>
        </div>
      </div>

      {canDispatch && (
        <button
          type="button"
          onClick={() => navigate(`/m/orders/${order.id}/dispatch`)}
          className="w-full min-h-16 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center gap-3 active:opacity-90 touch-manipulation shadow-level-2"
        >
          <Truck className="w-6 h-6" />
          New Dispatch Trip {trips.length + 1}
        </button>
      )}

      {trips.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Previous trips</h3>
          <ul className="space-y-2">
            {trips.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/m/dispatches/${d.id}`)}
                  className="w-full flex items-center justify-between bg-surface rounded-xl border border-border p-4 touch-manipulation active:bg-background"
                >
                  <div className="text-left">
                    <p className="font-semibold">{d.dispatchNo}</p>
                    <p className="text-xs text-text-secondary">
                      {formatDate(d.dispatchDate)} · {d.vehicle.vehicleNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <DispatchStatusChip status={d.status} />
                    <p className="text-sm font-bold tabular-nums mt-1">{d.totalQuantity} qty</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
