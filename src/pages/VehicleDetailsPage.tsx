import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Plus, Trash2, Truck } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { getItemAvailable, formatDimensions, sortOrderItemsByTagNo } from '@/lib/calculations'
import { calculateDispatchAccessories } from '@/lib/dispatchAccessories'
import { useAppStore } from '@/store/appStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DispatchStatusChip } from '@/components/ui/Chip'
import { QuantityControl } from '@/components/ui/QuantityControl'

export function VehicleDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatchDraft, setDispatchDraft } = useAppStore()
  const order = orderService.getOrderById(id!)

  const [quantities, setQuantities] = useState<Record<string, number>>(
    dispatchDraft?.orderId === id ? (dispatchDraft?.quantities ?? {}) : {},
  )
  const [loadSequence, setLoadSequence] = useState<string[]>(
    dispatchDraft?.orderId === id ? (dispatchDraft?.loadSequence ?? []) : [],
  )

  if (!order || !dispatchDraft?.vehicle) {
    navigate(`/orders/${id}/dispatch`)
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
    navigate(`/orders/${order.id}/dispatch/preview`)
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/orders/${order.id}/dispatch`)}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Vehicle &amp; Trip Details
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 2 of 3 · Load Ducts One by One
          </p>
          <h2 className="text-2xl font-semibold mt-0.5">
            {activeTrip ? `Loading Trip ${activeTrip.dispatchNo}` : 'Load Ducts onto Vehicle'}
          </h2>
          <p className="text-text-secondary">
            {order.jobName} · {order.customerName}
          </p>
        </div>
        <DispatchStatusChip status="loading" />
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">
                Vehicle: {dispatchDraft.vehicle.vehicleNumber} ({dispatchDraft.vehicle.vehicleType})
              </p>
              <p className="text-xs text-text-secondary">
                Driver: {dispatchDraft.vehicle.driverName} ({dispatchDraft.vehicle.driverMobile}) ·{' '}
                {dispatchDraft.vehicle.transporter}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary">Loaded in Trip</p>
            <p className="text-lg font-bold text-primary tabular-nums">
              {totalSelected} Ducts ({loadedItemsInOrder.length} tags)
            </p>
          </div>
        </div>
      </Card>

      {loadedItemsInOrder.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Loaded Ducts on Vehicle (Added in Sequence)
            </h3>
            <span className="text-xs font-semibold text-text-secondary">
              Total loaded: {totalSelected} Qty
            </span>
          </div>
          <div className="divide-y divide-border">
            {loadedItemsInOrder.map((item, idx) => {
              const available = getItemAvailable(item)
              const qty = quantities[item.id] ?? 0
              return (
                <div
                  key={item.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-semibold">DUCT {item.tagNo}</span>
                      <span className="text-text-secondary ml-2">{formatDimensions(item)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary tabular-nums">
                      Loaded: {qty} / {available}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItemQty(item.id, 0, available)}
                      className="text-text-secondary hover:text-error p-1"
                      title="Unload duct"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Add Ducts to Load</h3>
          <p className="text-xs text-text-secondary">
            Tap &ldquo;+ Load 1&rdquo; or adjust quantity as ducts are loaded one after another
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleSelectAll}>
          Load All Available
        </Button>
      </div>

      <div className="space-y-4">
        {availableItems.map((item) => {
          const available = getItemAvailable(item)
          const qty = quantities[item.id] ?? 0
          return (
            <Card key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg">DUCT {item.tagNo}</p>
                    {qty > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success">
                        Loaded: {qty}
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary">{formatDimensions(item)}</p>
                  <p className="text-sm text-text-secondary mt-1">
                    Available: <span className="font-semibold text-primary">{available}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={qty < available ? 'primary' : 'secondary'}
                    disabled={qty >= available}
                    onClick={() => handleLoadOne(item.id, available)}
                  >
                    <Plus className="w-4 h-4" />
                    Load 1
                  </Button>
                  <QuantityControl
                    value={qty}
                    max={available}
                    onChange={(v) => setItemQty(item.id, v, available)}
                  />
                </div>
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
            <p className="text-sm text-text-secondary">Total Loaded for Trip</p>
            <p className="text-2xl font-bold tabular-nums">{totalSelected} Qty</p>
          </div>
          <Button disabled={totalSelected === 0} onClick={handleContinue}>
            View Loaded Summary &amp; Accessories
          </Button>
        </div>
      </Card>
    </div>
  )
}
