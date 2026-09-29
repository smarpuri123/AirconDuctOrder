import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { useAppStore } from '@/store/appStore'
import { formatArea, getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function DispatchPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatchDraft, setDispatchDraft } = useAppStore()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const order = orderService.getOrderById(id!)

  if (!order || !dispatchDraft?.quantities || !dispatchDraft?.vehicle) {
    navigate(`/orders/${id}/dispatch`)
    return null
  }

  const selectedItems = order.items
    .filter((item) => (dispatchDraft.quantities![item.id] ?? 0) > 0)
    .map((item) => {
      const qty = dispatchDraft.quantities![item.id]
      const unitArea = item.orderedQty > 0 ? item.area / item.orderedQty : 0
      return { ...item, dispatchQty: qty, dispatchArea: unitArea * qty }
    })

  const currentQty = selectedItems.reduce((s, i) => s + i.dispatchQty, 0)
  const currentArea = selectedItems.reduce((s, i) => s + i.dispatchArea, 0)
  const previousDispatched = getOrderDispatchedQty(order)
  const totalAfter = previousDispatched + currentQty
  const remaining = getOrderBalanceQty(order) - currentQty

  const handleConfirm = async () => {
    setSubmitting(true)
    setError('')
    try {
      const dispatch = await dispatchService.createDispatch(
        order.id,
        dispatchDraft.quantities!,
        dispatchDraft.vehicle!,
      )
      setDispatchDraft(null)
      navigate(`/dispatch/${dispatch.id}/confirm`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dispatch')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/orders/${id}/dispatch/vehicle`)}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Vehicle
      </button>

      <h2 className="text-2xl font-semibold">Dispatch Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold mb-4">Order Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-text-secondary">Order</dt><dd className="font-medium">{order.orderNo}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Customer</dt><dd className="font-medium">{order.customerName}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Vehicle</dt><dd className="font-medium">{dispatchDraft.vehicle!.vehicleNumber}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Driver</dt><dd className="font-medium">{dispatchDraft.vehicle!.driverName}</dd></div>
          </dl>
        </Card>

        <Card>
          <h3 className="font-semibold mb-4">Quantities</h3>
          <dl className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between"><dt className="text-text-secondary">Current Dispatch</dt><dd className="font-bold text-lg">{currentQty} Qty · {formatArea(currentArea)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Previous Dispatched</dt><dd className="font-medium">{previousDispatched}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Total After</dt><dd className="font-medium text-success">{totalAfter}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Remaining</dt><dd className="font-medium text-warning">{remaining}</dd></div>
          </dl>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-4">Items</h3>
        <div className="divide-y divide-border">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex justify-between py-3 text-sm">
              <span>Tag {item.tagNo} — {item.w1} × {item.h1} × {item.length}</span>
              <span className="font-semibold tabular-nums">Qty {item.dispatchQty}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-4 justify-end">
        <Button variant="secondary" onClick={() => navigate(`/orders/${id}/dispatch/vehicle`)}>
          Back
        </Button>
        {error && <p className="text-error text-sm">{error}</p>}
        <Button variant="gold" onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Creating...' : 'Confirm Dispatch'}
        </Button>
      </div>
    </div>
  )
}
