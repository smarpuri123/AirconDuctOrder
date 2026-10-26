import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { useAppStore } from '@/store/appStore'
import { formatArea, getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'
import { calculateDispatchAccessories } from '@/lib/dispatchAccessories'
import type { DispatchAccessories, DispatchAccessoryMode } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DispatchStatusChip } from '@/components/ui/Chip'

export function DispatchPreviewPage() {
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
      navigate(`/dispatch/${dispatch.id}/confirm`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dispatch')
      setSubmitting(false)
    }
  }

  const accessoryRows: {
    key: 'corner' | 'nBolt' | 'cleat'
    label: string
    formulaHint: string
  }[] = [
    { key: 'corner', label: 'CORNNER', formulaHint: 'QTY × 8' },
    { key: 'nBolt', label: 'N/BOLT', formulaHint: 'CORNNER / 2' },
    { key: 'cleat', label: 'CLEAT', formulaHint: '(W1+H1+W2+H2)×350/100000' },
  ]

  return (
    <div className="space-y-6">
      <button
        onClick={() => {
          setDispatchDraft({ ...dispatchDraft, accessories })
          navigate(`/orders/${id}/dispatch/vehicle`)
        }}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Load Ducts
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 3 of 3 · Loaded Ducts &amp; Accessories Summary
          </p>
          <h2 className="text-2xl font-semibold mt-0.5">Dispatch Summary</h2>
        </div>
        <DispatchStatusChip status="loading" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold mb-4">Trip &amp; Vehicle Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Order</dt>
              <dd className="font-medium">{order.orderNo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Customer</dt>
              <dd className="font-medium">{order.customerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Vehicle</dt>
              <dd className="font-medium">
                {dispatchDraft.vehicle!.vehicleNumber} ({dispatchDraft.vehicle!.vehicleType})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Driver</dt>
              <dd className="font-medium">
                {dispatchDraft.vehicle!.driverName} · {dispatchDraft.vehicle!.driverMobile}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="font-semibold mb-4">Duct Quantities</h3>
          <dl className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Loaded in This Trip</dt>
              <dd className="font-bold text-lg">
                {currentQty} Qty · {formatArea(currentArea)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Previous Dispatched</dt>
              <dd className="font-medium">{previousDispatched}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Total After</dt>
              <dd className="font-medium text-success">{totalAfter}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Remaining Balance</dt>
              <dd className="font-medium text-warning">{remaining}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-4">Loaded Ducts ({currentQty} Qty)</h3>
        <div className="divide-y divide-border">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex justify-between py-3 text-sm">
              <span>
                Duct {item.tagNo} — {item.w1} × {item.h1} × {item.length} ({item.description})
              </span>
              <span className="font-semibold tabular-nums">Qty {item.dispatchQty}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold">
              Dispatch Accessories (CORNNER, N/BOLT, CLEAT)
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Calculated for the {accessories.mode === 'per_trip' ? `${currentQty} loaded ducts in this trip` : `entire order batch (${order.totalQuantity} ducts)`}. Edit quantities if needed and check the box to include in this dispatch trip.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-background text-xs">
              <button
                type="button"
                onClick={() => handleModeChange('per_trip')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  accessories.mode === 'per_trip'
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Per Trip ({currentQty} Ducts)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('entire_batch')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  accessories.mode === 'entire_batch'
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Entire Batch ({order.totalQuantity} Ducts)
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleModeChange(accessories.mode)}
              title="Recalculate from loaded ducts"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recalculate
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background border-b border-border text-text-secondary text-left">
                <th className="py-2.5 px-3 w-28">Include ✓</th>
                <th className="py-2.5 px-3">Accessory</th>
                <th className="py-2.5 px-3 text-right w-40">QTY (Editable)</th>
                <th className="py-2.5 px-3 w-24">UNITS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accessoryRows.map(({ key, label, formulaHint }) => {
                const entry = accessories[key]
                return (
                  <tr
                    key={key}
                    className={entry.included ? 'bg-surface' : 'bg-background/60 opacity-60'}
                  >
                    <td className="py-3 px-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={entry.included}
                          onChange={() => toggleAccessoryIncluded(key)}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                        {entry.included && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-success">
                            <Check className="w-3.5 h-3.5" /> Yes
                          </span>
                        )}
                      </label>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold">{label}</span>
                      <span className="text-xs text-text-secondary ml-2">({formulaHint})</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={entry.quantity}
                        disabled={!entry.included}
                        onChange={(e) => updateAccessoryQty(key, e.target.value)}
                        className="w-28 h-9 px-2.5 rounded-md border border-border bg-surface text-right font-semibold tabular-nums disabled:opacity-50"
                      />
                    </td>
                    <td className="py-3 px-3 font-medium text-text-secondary">NOS</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex gap-4 justify-end items-center">
        <Button
          variant="secondary"
          onClick={() => {
            setDispatchDraft({ ...dispatchDraft, accessories })
            navigate(`/orders/${id}/dispatch/vehicle`)
          }}
        >
          Back to Load Ducts
        </Button>
        {error && <p className="text-error text-sm">{error}</p>}
        <Button variant="gold" onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Saving Dispatch…' : 'Confirm Loaded Dispatch'}
        </Button>
      </div>
    </div>
  )
}
