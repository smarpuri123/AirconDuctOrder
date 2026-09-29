import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { useAppStore } from '@/store/appStore'
import { getOrderBalanceQty, sortOrderItemsByTagNo } from '@/lib/calculations'

export function MobileDispatchPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatchDraft, setDispatchDraft } = useAppStore()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const order = orderService.getOrderById(id!)

  if (!order || !dispatchDraft?.quantities || !dispatchDraft?.vehicle) {
    navigate(`/m/orders/${id}/dispatch`)
    return null
  }

  const selectedItems = sortOrderItemsByTagNo(
    order.items.filter((item) => (dispatchDraft.quantities![item.id] ?? 0) > 0),
  ).map((item) => ({
    ...item,
    dispatchQty: dispatchDraft.quantities![item.id],
  }))

  const currentQty = selectedItems.reduce((s, i) => s + i.dispatchQty, 0)
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
      navigate(`/m/dispatches/${dispatch.id}/confirm`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dispatch')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <button
        type="button"
        onClick={() => navigate(`/m/orders/${id}/vehicle`)}
        className="flex items-center gap-2 text-text-secondary min-h-11 touch-manipulation"
      >
        <ArrowLeft className="w-5 h-5" />
        Vehicle
      </button>

      <h2 className="text-xl font-bold">Confirm Dispatch</h2>

      <div className="bg-surface rounded-xl border border-border p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Vehicle</span>
          <span className="font-semibold">{dispatchDraft.vehicle!.vehicleNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Driver</span>
          <span className="font-semibold">{dispatchDraft.vehicle!.driverName}</span>
        </div>
        <div className="flex justify-between tabular-nums">
          <span className="text-text-secondary">This trip</span>
          <span className="font-bold text-lg">{currentQty} qty</span>
        </div>
        <div className="flex justify-between tabular-nums">
          <span className="text-text-secondary">After dispatch</span>
          <span className="font-semibold text-warning">{remaining} remaining</span>
        </div>
      </div>

      <ul className="bg-surface rounded-xl border border-border divide-y divide-border">
        {selectedItems.map((item) => (
          <li key={item.id} className="flex justify-between px-4 py-3 text-sm">
            <span>Tag {item.tagNo}</span>
            <span className="font-bold tabular-nums">{item.dispatchQty}</span>
          </li>
        ))}
      </ul>

      {error && <p className="text-error text-sm">{error}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full min-h-16 rounded-xl bg-secondary text-white font-bold text-lg disabled:opacity-50 touch-manipulation"
      >
        {submitting ? 'Creating…' : 'Confirm Dispatch'}
      </button>
    </div>
  )
}
