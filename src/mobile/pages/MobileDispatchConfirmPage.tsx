import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { dispatchService } from '@/services/dispatchService'
import { orderService } from '@/services/orderService'
import { getOrderBalanceQty } from '@/lib/calculations'
import { ShareActions } from '@/mobile/components/ShareActions'

export function MobileDispatchConfirmPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = dispatchService.getDispatchById(id!)
  const order = dispatch ? orderService.getOrderById(dispatch.orderId) : undefined

  if (!dispatch || !order) {
    return <p className="text-text-secondary">Dispatch not found.</p>
  }

  const balance = getOrderBalanceQty(order)

  return (
    <div className="space-y-6 text-center pt-4">
      <div className="w-20 h-20 rounded-full bg-success-bg flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">Dispatch Created</h2>
        <p className="text-primary font-bold text-lg mt-1">{dispatch.dispatchNo}</p>
      </div>

      <div className="bg-surface rounded-xl border border-border p-4 text-left space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Order</span>
          <span className="font-semibold">{order.orderNo}</span>
        </div>
        <div className="flex justify-between tabular-nums">
          <span className="text-text-secondary">Quantity</span>
          <span className="font-bold">{dispatch.totalQuantity}</span>
        </div>
        <div className="flex justify-between tabular-nums">
          <span className="text-text-secondary">Balance left</span>
          <span className="font-bold text-warning">{balance}</span>
        </div>
      </div>

      {balance === 0 && (
        <p className="bg-success-bg text-success font-semibold rounded-xl py-3 px-4">
          Order fully dispatched
        </p>
      )}

      <ShareActions dispatch={dispatch} order={order} />

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate(`/m/dispatches/${dispatch.id}`)}
          className="w-full min-h-12 rounded-xl border-2 border-primary text-primary font-semibold touch-manipulation"
        >
          View Dispatch Note
        </button>
        <button
          type="button"
          onClick={() => navigate('/m/orders')}
          className="w-full min-h-12 text-text-secondary font-medium touch-manipulation"
        >
          Back to Orders
        </button>
      </div>
    </div>
  )
}
