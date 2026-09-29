import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { useAppStore } from '@/store/appStore'
import {
  formatDimensions,
  getItemAvailable,
  sortOrderItemsByTagNo,
} from '@/lib/calculations'
import { MobileQuantityControl } from '@/mobile/components/MobileQuantityControl'
import { useApiData } from '@/hooks/useApiData'

export function MobileCreateDispatchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setDispatchDraft } = useAppStore()
  useApiData()
  const order = orderService.getOrderById(id!)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  if (!order) return <p className="text-text-secondary">Order not found.</p>

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
    navigate(`/m/orders/${order.id}/vehicle`)
  }

  return (
    <div className="space-y-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(`/m/orders/${order.id}`)}
        className="flex items-center gap-2 text-text-secondary min-h-11 touch-manipulation"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Select Tags</h2>
          <p className="text-sm text-text-secondary">{order.orderNo}</p>
        </div>
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-sm font-semibold text-primary px-3 py-2 rounded-lg bg-primary/10 touch-manipulation"
        >
          All
        </button>
      </div>

      {availableItems.length === 0 && (
        <p className="text-center text-text-secondary py-12">No stock available to dispatch.</p>
      )}

      <ul className="space-y-4">
        {availableItems.map((item) => {
          const available = getItemAvailable(item)
          const qty = quantities[item.id] ?? 0
          return (
            <li
              key={item.id}
              className="bg-surface rounded-xl border border-border p-4 shadow-level-1"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="text-xl font-bold">Tag {item.tagNo}</p>
                  <p className="text-sm text-text-secondary">{formatDimensions(item)}</p>
                  <p className="text-sm mt-1">
                    Available: <span className="font-bold text-primary">{available}</span>
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <MobileQuantityControl
                  value={qty}
                  max={available}
                  onChange={(v) => setQuantities((prev) => ({ ...prev, [item.id]: v }))}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-0 px-4 z-10"
      >
        <div className="max-w-lg mx-auto bg-surface border border-border rounded-xl p-4 shadow-level-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-text-secondary">Selected</p>
            <p className="text-2xl font-bold tabular-nums">{totalSelected} qty</p>
          </div>
          <button
            type="button"
            disabled={totalSelected === 0}
            onClick={handleContinue}
            className="min-h-14 px-8 rounded-xl bg-primary text-white font-bold disabled:opacity-40 touch-manipulation"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
