import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { useAppStore } from '@/store/appStore'
import { getOrderBalanceQty, sortOrderItemsByTagNo } from '@/lib/calculations'
import { calculateDispatchAccessories } from '@/lib/dispatchAccessories'
import { DispatchStatusChip } from '@/components/ui/Chip'
import type { DispatchAccessories, DispatchAccessoryMode } from '@/types'

export function MobileDispatchPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatchDraft, setDispatchDraft } = useAppStore()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const order = orderService.getOrderById(id!)
  const enquiry = order ? enquiryService.getEnquiryByOrderId(order.id) : undefined

  const initialAccessories: DispatchAccessories =
    dispatchDraft?.accessories ??
    (order && dispatchDraft?.quantities
      ? calculateDispatchAccessories(
          order,
          dispatchDraft.quantities,
          'per_trip',
          enquiry?.ductLines,
        )
      : {
          mode: 'per_trip',
          corner: { quantity: 0, included: true },
          nBolt: { quantity: 0, included: true },
          cleat: { quantity: 0, included: true },
        })

  const [accessories, setAccessories] = useState<DispatchAccessories>(initialAccessories)

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
  const remaining = Math.max(0, getOrderBalanceQty(order) - currentQty)

  const handleModeChange = (nextMode: DispatchAccessoryMode) => {
    const recalculated = calculateDispatchAccessories(
      order,
      dispatchDraft.quantities!,
      nextMode,
      enquiry?.ductLines,
      {
        corner: accessories.corner.included,
        nBolt: accessories.nBolt.included,
        cleat: accessories.cleat.included,
      },
    )
    setAccessories(recalculated)
  }

  const updateAccessoryQty = (key: 'corner' | 'nBolt' | 'cleat', raw: string) => {
    const parsed = Math.max(0, parseInt(raw, 10) || 0)
    setAccessories((prev) => ({
      ...prev,
      [key]: { ...prev[key], quantity: parsed },
    }))
  }

  const toggleAccessoryIncluded = (key: 'corner' | 'nBolt' | 'cleat') => {
    setAccessories((prev) => ({
      ...prev,
      [key]: { ...prev[key], included: !prev[key].included },
    }))
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    setError('')
    try {
      const dispatch = await dispatchService.createDispatch(
        order.id,
        dispatchDraft.quantities!,
        dispatchDraft.vehicle!,
        accessories,
        dispatchDraft.dispatchId,
      )
      setDispatchDraft(null)
      navigate(`/m/dispatches/${dispatch.id}/confirm`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dispatch')
      setSubmitting(false)
    }
  }

  const accessoryRows: { key: 'corner' | 'nBolt' | 'cleat'; label: string }[] = [
    { key: 'corner', label: 'CORNNER' },
    { key: 'nBolt', label: 'N/BOLT' },
    { key: 'cleat', label: 'CLEAT' },
  ]

  return (
    <div className="space-y-4 pb-8">
      <button
        type="button"
        onClick={() => {
          setDispatchDraft({ ...dispatchDraft, accessories })
          navigate(`/m/orders/${id}/vehicle`)
        }}
        className="flex items-center gap-2 text-text-secondary min-h-11 touch-manipulation"
      >
        <ArrowLeft className="w-5 h-5" />
        Load Ducts
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 3 of 3 · Loaded Summary
          </p>
          <h2 className="text-xl font-bold">Confirm Dispatch</h2>
        </div>
        <DispatchStatusChip status="loading" />
      </div>

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
          <span className="text-text-secondary">Loaded this trip</span>
          <span className="font-bold text-lg">{currentQty} qty</span>
        </div>
        <div className="flex justify-between tabular-nums">
          <span className="text-text-secondary">After dispatch</span>
          <span className="font-semibold text-warning">{remaining} remaining</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Loaded Ducts ({currentQty} qty)</h3>
        <ul className="bg-surface rounded-xl border border-border divide-y divide-border">
          {selectedItems.map((item) => (
            <li key={item.id} className="flex justify-between px-4 py-3 text-sm">
              <span>Duct {item.tagNo}</span>
              <span className="font-bold tabular-nums">{item.dispatchQty} qty</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Dispatch Accessories</h3>
            <p className="text-xs text-text-secondary">
              Check ✓ to include and edit quantities if needed
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleModeChange(accessories.mode)}
            className="inline-flex items-center gap-1 text-xs text-primary font-semibold px-2 py-1 rounded-lg bg-primary/10 touch-manipulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-background border border-border text-xs">
          <button
            type="button"
            onClick={() => handleModeChange('per_trip')}
            className={`min-h-9 rounded-lg font-semibold touch-manipulation ${
              accessories.mode === 'per_trip'
                ? 'bg-primary text-white'
                : 'text-text-secondary'
            }`}
          >
            Per Trip ({currentQty} Ducts)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('entire_batch')}
            className={`min-h-9 rounded-lg font-semibold touch-manipulation ${
              accessories.mode === 'entire_batch'
                ? 'bg-primary text-white'
                : 'text-text-secondary'
            }`}
          >
            Entire Batch ({order.totalQuantity})
          </button>
        </div>

        <div className="divide-y divide-border">
          {accessoryRows.map(({ key, label }) => {
            const entry = accessories[key]
            return (
              <div
                key={key}
                className={`py-2.5 flex items-center justify-between gap-3 ${
                  entry.included ? '' : 'opacity-60'
                }`}
              >
                <label className="flex items-center gap-2.5 cursor-pointer select-none min-h-10">
                  <input
                    type="checkbox"
                    checked={entry.included}
                    onChange={() => toggleAccessoryIncluded(key)}
                    className="w-5 h-5 accent-primary rounded"
                  />
                  <span className="font-bold text-sm">{label}</span>
                  {entry.included && <Check className="w-4 h-4 text-success" />}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    disabled={!entry.included}
                    value={entry.quantity}
                    onChange={(e) => updateAccessoryQty(key, e.target.value)}
                    className="w-24 h-10 px-2.5 rounded-lg border-2 border-border bg-background text-right font-bold tabular-nums text-sm disabled:opacity-50"
                  />
                  <span className="text-xs font-semibold text-text-secondary w-8">NOS</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full min-h-16 rounded-xl bg-secondary text-white font-bold text-lg disabled:opacity-50 touch-manipulation"
      >
        {submitting ? 'Saving Dispatch…' : 'Confirm Loaded Dispatch'}
      </button>
    </div>
  )
}
