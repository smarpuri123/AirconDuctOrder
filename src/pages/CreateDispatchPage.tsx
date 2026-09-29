import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { getItemAvailable, formatDimensions, sortOrderItemsByTagNo } from '@/lib/calculations'
import { useAppStore } from '@/store/appStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { QuantityControl } from '@/components/ui/QuantityControl'

export function CreateDispatchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setDispatchDraft } = useAppStore()
  const order = orderService.getOrderById(id!)

  const [quantities, setQuantities] = useState<Record<string, number>>({})

  if (!order) return <p>Order not found.</p>

  const availableItems = sortOrderItemsByTagNo(
    order.items.filter((item) => getItemAvailable(item) > 0),
  )

  const totalSelected = Object.values(quantities).reduce((s, q) => s + q, 0)

  const handleSelectAll = () => {
    const all: Record<string, number> = {}
    availableItems.forEach((item) => {
      all[item.id] = getItemAvailable(item)
    })
    setQuantities(all)
  }

  const handleContinue = () => {
    if (totalSelected === 0) return
    setDispatchDraft({ orderId: order.id, quantities })
    navigate(`/orders/${order.id}/dispatch/vehicle`)
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/orders/${order.id}`)}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Order
      </button>

      <div>
        <h2 className="text-2xl font-semibold">Create Dispatch</h2>
        <p className="text-text-secondary">{order.jobName} · {order.customerName}</p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Select Items</h3>
        <Button variant="secondary" size="sm" onClick={handleSelectAll}>
          Select All Available
        </Button>
      </div>

      <div className="space-y-4">
        {availableItems.map((item) => {
          const available = getItemAvailable(item)
          const qty = quantities[item.id] ?? 0
          return (
            <Card key={item.id}>
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="font-semibold text-lg">TAG {item.tagNo}</p>
                  <p className="text-text-secondary">{formatDimensions(item)}</p>
                  <p className="text-sm text-text-secondary mt-1">
                    Available: <span className="font-semibold text-primary">{available}</span>
                  </p>
                </div>
                <QuantityControl
                  value={qty}
                  max={available}
                  onChange={(v) => setQuantities((prev) => ({ ...prev, [item.id]: v }))}
                />
              </div>
            </Card>
          )
        })}
      </div>

      {availableItems.length === 0 && (
        <Card>
          <p className="text-text-secondary text-center py-8">No items available for dispatch.</p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-secondary">Selected for dispatch</p>
            <p className="text-2xl font-bold tabular-nums">{totalSelected} Qty</p>
          </div>
          <Button disabled={totalSelected === 0} onClick={handleContinue}>
            Continue to Vehicle Details
          </Button>
        </div>
      </Card>
    </div>
  )
}
