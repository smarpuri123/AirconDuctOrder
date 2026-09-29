import { useNavigate } from 'react-router-dom'
import type { Order } from '@/types'
import { formatArea, getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'
import { Card } from '@/components/ui/Card'
import { OrderStatusChip } from '@/components/ui/Chip'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Truck } from 'lucide-react'

interface OrderCardProps {
  order: Order
}

export function OrderCard({ order }: OrderCardProps) {
  const navigate = useNavigate()
  const dispatched = getOrderDispatchedQty(order)
  const balance = getOrderBalanceQty(order)
  const canDispatch = balance > 0 && order.status !== 'production'

  return (
    <Card hover onClick={() => navigate(`/orders/${order.id}`)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{order.jobName}</h3>
          <p className="text-text-secondary text-sm">{order.customerName}</p>
        </div>
        <OrderStatusChip status={order.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-text-secondary">Quantity</p>
          <p className="text-lg font-semibold tabular-nums">{order.totalQuantity}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Area</p>
          <p className="text-lg font-semibold tabular-nums">{formatArea(order.totalArea)}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Dispatched</p>
          <p className="text-lg font-semibold tabular-nums text-success">{dispatched}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Balance</p>
          <p className="text-lg font-semibold tabular-nums text-warning">{balance}</p>
        </div>
      </div>

      <ProgressBar value={dispatched} max={order.totalQuantity} showPercent />

      {canDispatch && (
        <Button
          className="mt-4"
          fullWidth
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/orders/${order.id}/dispatch`)
          }}
        >
          <Truck className="w-4 h-4" />
          Dispatch
        </Button>
      )}
    </Card>
  )
}
