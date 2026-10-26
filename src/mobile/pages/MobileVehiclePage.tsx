import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Plus, Trash2, Truck } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { useAppStore } from '@/store/appStore'
import {
  formatDimensions,
  getItemAvailable,
  sortOrderItemsByTagNo,
} from '@/lib/calculations'
import { calculateDispatchAccessories } from '@/lib/dispatchAccessories'
import { DispatchStatusChip } from '@/components/ui/Chip'
import { MobileQuantityControl } from '@/mobile/components/MobileQuantityControl'
import { useApiData } from '@/hooks/useApiData'

export function MobileVehiclePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatchDraft, setDispatchDraft } = useAppStore()
  useApiData()
  const order = orderService.getOrderById(id!)

  const [quantities, setQuantities] = useState<Record<string, number>>(
    dispatchDraft?.orderId === id ? (dispatchDraft?.quantities ?? {}) : {},
  )
  const [loadSequence, setLoadSequence] = useState<string[]>(
    dispatchDraft?.orderId === id ? (dispatchDraft?.loadSequence ?? []) : [],
  )

  if (!order || !dispatchDraft?.vehicle) {
    navigate(`/m/orders/${id}/dispatch`)
    return null
  }

  const activeTrip = dispatchDraft.dispatchId
    ? dispatchService.getDispatchById(dispatchDraft.dispatchId)
    : undefined

  const availableItems = sortOrderItemsByTagNo(
    order.items.filter((item) => getItemAvailable(item) > 0 || (quantities[item.id] ?? 0) > 0),
  )

  const setItemQty = (itemId: string, nextQty: number, maxAvail: number) => {
    const clamped = Math.max(0, Math.min(maxAvail, nextQty))
    setQuantities((prev) => ({ ...prev, [itemId]: clamped }))
    setLoadSequence((prev) => {
      if (clamped > 0 && !prev.includes(itemId)) {
        return [...prev, itemId]
      }
      if (clamped <= 0) {
        return prev.filter((k) => k !== itemId)
      }
      return prev
    })
  }

  const handleLoadOne = (itemId: string, maxAvail: number) => {
    const cur = quantities[itemId] ?? 0
    if (cur < maxAvail) {
      setItemQty(itemId, cur + 1, maxAvail)
    }
  }

  const handleSelectAll = () => {
    const all: Record<string, number> = {}
    const seq: string[] = [...loadSequence]
    availableItems.forEach((item) => {
      const avail = getItemAvailable(item)
      if (avail > 0) {
        all[item.id] = avail
        if (!seq.includes(item.id)) seq.push(item.id)
      }
    })
    setQuantities(all)
    setLoadSequence(seq)
  }

  const loadedItemsInOrder = loadSequence
    .map((itemId) => order.items.find((i) => i.id === itemId))
    .filter((i): i is NonNullable<typeof i> => Boolean(i) && (quantities[i!.id] ?? 0) > 0)

  const totalSelected = Object.values(quantities).reduce((s, q) => s + q, 0)

  const handleContinue = () => {
    if (totalSelected === 0) return
    const enquiry = enquiryService.getEnquiryByOrderId(order.id)
    const accessories = calculateDispatchAccessories(
      order,
      quantities,
      'per_trip',
      enquiry?.ductLines,
    )
    setDispatchDraft({
      ...dispatchDraft,
      orderId: order.id,
      quantities,
      loadSequence,
      accessories,
    })
    navigate(`/m/orders/${order.id}/preview`)
  }

  return (
    <div className="space-y-4 pb-28">
      <button
        type="button"
        onClick={() => navigate(`/m/orders/${order.id}/dispatch`)}
        className="flex items-center gap-2 text-text-secondary min-h-11 touch-manipulation"
      >
        <ArrowLeft className="w-5 h-5" />
        Vehicle Details
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 2 of 3 · Load Ducts One by One
          </p>
          <h2 className="text-xl font-bold">
            {activeTrip ? `Loading ${activeTrip.dispatchNo}` : 'Load Ducts'}
          </h2>
          <p className="text-sm text-text-secondary">{order.orderNo}</p>
        </div>
        <DispatchStatusChip status="loading" />
      </div>

      <div className="bg-surface rounded-xl border border-border p-3 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{dispatchDraft.vehicle.vehicleNumber}</p>
            <p className="text-xs text-text-secondary truncate">
              {dispatchDraft.vehicle.driverName} · {dispatchDraft.vehicle.transporter}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-xs font-semibold text-primary px-3 py-2 rounded-lg bg-primary/10 touch-manipulation shrink-0"
        >
          Load All
        </button>
      </div>

      {loadedItemsInOrder.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-success flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Loaded on Vehicle ({totalSelected} qty)
            </p>
          </div>
          <ul className="divide-y divide-border text-sm">
            {loadedItemsInOrder.map((item, idx) => (
              <li key={item.id} className="py-2 flex items-center justify-between gap-2">
                <span className="font-medium">
                  #{idx + 1} Duct {item.tagNo}{' '}
                  <span className="text-xs text-text-secondary">({formatDimensions(item)})</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary tabular-nums">
                    {quantities[item.id]} qty
                  </span>
                  <button
                    type="button"
                    onClick={() => setItemQty(item.id, 0, getItemAvailable(item))}
                    className="p-1 text-text-secondary active:text-error"
                    aria-label="Unload duct"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold">Duct {item.tagNo}</p>
                    {qty > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success">
                        Loaded: {qty}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">{formatDimensions(item)}</p>
                  <p className="text-sm mt-1">
                    Available: <span className="font-bold text-primary">{available}</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={qty >= available}
                  onClick={() => handleLoadOne(item.id, available)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-40 touch-manipulation shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Load 1
                </button>
              </div>
              <div className="flex justify-center">
                <MobileQuantityControl
                  value={qty}
                  max={available}
                  onChange={(v) => setItemQty(item.id, v, available)}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-0 px-4 z-10">
        <div className="max-w-lg mx-auto bg-surface border border-border rounded-xl p-4 shadow-level-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-text-secondary">Loaded</p>
            <p className="text-2xl font-bold tabular-nums">{totalSelected} qty</p>
          </div>
          <button
            type="button"
            disabled={totalSelected === 0}
            onClick={handleContinue}
            className="min-h-14 px-6 rounded-xl bg-primary text-white font-bold disabled:opacity-40 touch-manipulation"
          >
            View Summary
          </button>
        </div>
      </div>
    </div>
  )
}
