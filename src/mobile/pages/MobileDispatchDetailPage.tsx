import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Edit3 } from 'lucide-react'
import { dispatchService } from '@/services/dispatchService'
import { orderService } from '@/services/orderService'
import { enquiryService } from '@/services/enquiryService'
import { useAppStore } from '@/store/appStore'
import { formatArea, formatDate } from '@/lib/calculations'
import { resolveDispatchAccessories } from '@/lib/dispatchAccessories'
import { ShareActions } from '@/mobile/components/ShareActions'
import { DispatchStatusChip } from '@/components/ui/Chip'
import type { DispatchStatus } from '@/types'
import {
  DISPATCH_STATUS_ACTIONS,
  canTransitionDispatchTo,
  isDispatchStatusCompleted,
  normalizeDispatchStatus,
} from '@/lib/dispatchWorkflow'

export function MobileDispatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setDispatchDraft } = useAppStore()
  const [version, setVersion] = useState(0)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  const dispatch = dispatchService.getDispatchById(id!)
  const order = dispatch ? orderService.getOrderById(dispatch.orderId) : undefined
  const enquiry = order ? enquiryService.getEnquiryByOrderId(order.id) : undefined

  if (!dispatch || !order) {
    return <p className="text-text-secondary">Dispatch not found.</p>
  }

  const reload = () => setVersion((v) => v + 1)

  const rawStatus = normalizeDispatchStatus(dispatch.status)
  const currentStatus: DispatchStatus =
    rawStatus === 'loading' && dispatch.items.length > 0 ? 'loaded' : rawStatus
  const acc = resolveDispatchAccessories(dispatch, order, enquiry?.ductLines)
  const accessoryRows = [
    { label: 'CORNNER', ...acc.corner },
    { label: 'N/BOLT', ...acc.nBolt },
    { label: 'CLEAT', ...acc.cleat },
  ]

  const handleEditLoadingTrip = () => {
    const quantities: Record<string, number> = {}
    const loadSequence: string[] = []
    for (const item of dispatch.items) {
      quantities[item.orderItemId] = item.quantity
      loadSequence.push(item.orderItemId)
    }
    setDispatchDraft({
      orderId: order.id,
      dispatchId: dispatch.id,
      vehicle: dispatch.vehicle,
      quantities,
      loadSequence,
      accessories: acc,
    })
    navigate(`/m/orders/${order.id}/vehicle`)
  }

  const handleStatusUpdate = async (status: DispatchStatus) => {
    if (!canTransitionDispatchTo(currentStatus, status)) return
    setUpdating(true)
    setError('')
    try {
      await dispatchService.updateDispatchStatus(dispatch.id, status)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-5 pb-8" key={version}>
      <button
        type="button"
        onClick={() => navigate('/m/dispatches')}
        className="flex items-center gap-2 text-text-secondary min-h-11 touch-manipulation"
      >
        <ArrowLeft className="w-5 h-5" />
        Dispatches
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{dispatch.dispatchNo}</h2>
          <p className="text-text-secondary text-sm">{order.orderNo}</p>
        </div>
        <DispatchStatusChip status={currentStatus} />
      </div>

      {(currentStatus === 'loading' || currentStatus === 'loaded') && (
        <button
          type="button"
          onClick={handleEditLoadingTrip}
          className="w-full min-h-12 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 touch-manipulation"
        >
          <Edit3 className="w-4 h-4" />
          {dispatch.items.length === 0 ? 'Load Ducts onto Vehicle' : 'Edit Loaded Ducts & Accessories'}
        </button>
      )}

      <div className="bg-surface rounded-xl border border-border p-4 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-text-secondary">Customer</span>
          <span className="font-semibold text-right">{order.customerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Vehicle</span>
          <span className="font-semibold">{dispatch.vehicle.vehicleNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Driver</span>
          <span className="font-semibold">{dispatch.vehicle.driverName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Date</span>
          <span className="font-semibold">{formatDate(dispatch.dispatchDate)}</span>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Loaded Ducts</h3>
        <ul className="bg-surface rounded-xl border border-border divide-y divide-border">
          {dispatch.items.map((item) => (
            <li key={item.orderItemId} className="flex justify-between px-4 py-3 text-sm">
              <span>Duct {item.tagNo}</span>
              <span className="font-bold tabular-nums">{item.quantity} qty</span>
            </li>
          ))}
          {dispatch.items.length === 0 && (
            <li className="px-4 py-3 text-sm text-text-secondary">
              No ducts loaded yet. Tap &ldquo;Load Ducts onto Vehicle&rdquo; above.
            </li>
          )}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">
          Accessories ({acc.mode === 'entire_batch' ? 'Entire Batch' : 'Per Trip'})
        </h3>
        <ul className="bg-surface rounded-xl border border-border divide-y divide-border text-sm">
          {accessoryRows.map((row) => (
            <li key={row.label} className="flex items-center justify-between px-4 py-3">
              <span className="inline-flex items-center gap-2 font-semibold">
                {row.included ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <span className="w-4 h-4 inline-block" />
                )}
                {row.label}
              </span>
              <span className="font-bold tabular-nums">
                {row.included ? `${row.quantity} NOS` : 'Not included'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm tabular-nums">
        <div className="bg-surface rounded-xl p-3 border border-border">
          <p className="text-text-secondary text-xs">Trip qty</p>
          <p className="font-bold text-lg">{dispatch.totalQuantity}</p>
        </div>
        <div className="bg-surface rounded-xl p-3 border border-border">
          <p className="text-text-secondary text-xs">Trip area</p>
          <p className="font-bold text-lg">{formatArea(dispatch.totalArea)}</p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Update status</h3>
        <div className="grid grid-cols-2 gap-2">
          {DISPATCH_STATUS_ACTIONS.map(({ status, label }) => {
            const isCurrent = currentStatus === status
            const isDone = isDispatchStatusCompleted(currentStatus, status)
            const canAdvance = canTransitionDispatchTo(currentStatus, status)
            return (
              <button
                key={status}
                type="button"
                disabled={updating || !canAdvance}
                onClick={() => handleStatusUpdate(status)}
                className={`min-h-12 px-3 rounded-xl text-sm font-semibold border-2 touch-manipulation disabled:opacity-40 ${
                  isCurrent
                    ? 'border-primary bg-primary/10 text-primary'
                    : isDone
                      ? 'border-success/40 bg-success-bg text-success'
                      : canAdvance
                        ? 'border-secondary bg-surface text-text-primary'
                        : 'border-border bg-surface text-text-secondary'
                }`}
              >
                {isDone ? `${label} ✓` : label}
              </button>
            )
          })}
        </div>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
      </div>

      <div>
        <h3 className="font-semibold mb-3">Share</h3>
        <ShareActions dispatch={dispatch} order={order} />
      </div>
    </div>
  )
}
