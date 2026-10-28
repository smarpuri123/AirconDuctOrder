import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Download, Edit3, Loader2, Mail, MessageCircle } from 'lucide-react'
import { dispatchService } from '@/services/dispatchService'
import { orderService } from '@/services/orderService'
import { enquiryService } from '@/services/enquiryService'
import { useAppStore } from '@/store/appStore'
import {
  formatArea,
  formatDate,
  getOrderBalanceQty,
  getOrderDispatchedQty,
} from '@/lib/calculations'
import { resolveDispatchAccessories } from '@/lib/dispatchAccessories'
import {
  DISPATCH_STATUS_ACTIONS,
  canTransitionDispatchTo,
  isDispatchStatusCompleted,
  normalizeDispatchStatus,
} from '@/lib/dispatchWorkflow'
import {
  generateWhatsAppMessage,
  shareWhatsApp,
  generateEmailContent,
  shareEmail,
  generateDispatchPDF,
} from '@/lib/share'
import type { DispatchStatus } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DispatchStatusChip } from '@/components/ui/Chip'
import { WorkflowConfirmModal, StepSuccessModal } from '@/components/ui/WorkflowConfirmModal'

export function DispatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setDispatchDraft } = useAppStore()
  const [version, setVersion] = useState(0)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [pendingStatus, setPendingStatus] = useState<DispatchStatus | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [successModal, setSuccessModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  })

  const dispatch = dispatchService.getDispatchById(id!)
  const order = dispatch ? orderService.getOrderById(dispatch.orderId) : undefined
  const enquiry = order ? enquiryService.getEnquiryByOrderId(order.id) : undefined

  if (!dispatch || !order) {
    return <p className="text-text-secondary">Dispatch not found.</p>
  }

  const isConfirm = window.location.pathname.endsWith('/confirm')
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
    navigate(`/orders/${order.id}/dispatch/vehicle`)
  }

  const handleExecuteStatusUpdate = async () => {
    if (!pendingStatus || !canTransitionDispatchTo(currentStatus, pendingStatus) || updatingStatus) return
    const target = pendingStatus
    const targetLabel =
      DISPATCH_STATUS_ACTIONS.find((a) => a.status === target)?.label ?? target
    setUpdatingStatus(true)
    setStatusError('')
    try {
      await dispatchService.updateDispatchStatus(dispatch.id, target)
      setPendingStatus(null)
      setVersion((v) => v + 1)
      setSuccessModal({
        open: true,
        title: 'Dispatch Status Updated',
        message: `Dispatch trip status successfully advanced to "${targetLabel}".`,
      })
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="space-y-6" key={version}>
      {!isConfirm && (
        <button
          onClick={() => navigate('/dispatch')}
          className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dispatches
        </button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Dispatch Note</h2>
          <p className="text-text-secondary">{dispatch.dispatchNo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(currentStatus === 'loading' || currentStatus === 'loaded') && (
            <Button size="sm" variant="secondary" onClick={handleEditLoadingTrip}>
              <Edit3 className="w-4 h-4" />
              {dispatch.items.length === 0 ? 'Load Ducts onto Vehicle' : 'Edit Loaded Ducts & Accessories'}
            </Button>
          )}
          <DispatchStatusChip status={currentStatus} />
        </div>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Dispatch Status Progression
          </span>
          <div className="flex flex-wrap gap-2">
            {DISPATCH_STATUS_ACTIONS.map(({ status, label }) => {
              const isCurrent = currentStatus === status
              const isDone = isDispatchStatusCompleted(currentStatus, status)
              const canAdvance = canTransitionDispatchTo(currentStatus, status)
              return (
                <button
                  key={status}
                  type="button"
                  disabled={updatingStatus || !canAdvance}
                  onClick={() => setPendingStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    isCurrent
                      ? 'border-primary bg-primary/10 text-primary'
                      : isDone
                        ? 'border-success/40 bg-success-bg text-success'
                        : canAdvance
                          ? 'border-secondary bg-secondary text-white hover:opacity-90 cursor-pointer'
                          : 'border-border bg-surface text-text-secondary'
                  }`}
                >
                  {isDone ? `${label} ✓` : label}
                </button>
              )
            })}
          </div>
        </div>
        {statusError && <p className="text-error text-xs mt-2">{statusError}</p>}
      </Card>

      <Card>
        <div className="text-center border-b border-border pb-6 mb-6">
          <h3 className="text-lg font-bold text-primary">ECOVENT AIR SYSTEMS INDIA LLP</h3>
          <p className="text-sm text-text-secondary">Quality Ducts Is Our Business</p>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <dt className="text-text-secondary">Dispatch No</dt>
            <dd className="font-semibold">{dispatch.dispatchNo}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Date</dt>
            <dd className="font-semibold">{formatDate(dispatch.dispatchDate)}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Order No</dt>
            <dd className="font-semibold">{order.orderNo}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Customer</dt>
            <dd className="font-semibold">{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Vehicle</dt>
            <dd className="font-semibold">{dispatch.vehicle.vehicleNumber}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Driver</dt>
            <dd className="font-semibold">{dispatch.vehicle.driverName}</dd>
          </div>
        </dl>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-primary text-white">
              <th className="p-2 text-left">Duct</th>
              <th className="p-2 text-left">Desc</th>
              <th className="p-2 text-right">W×H×L</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Area</th>
            </tr>
          </thead>
          <tbody>
            {dispatch.items.map((item) => (
              <tr key={item.orderItemId} className="border-b border-border">
                <td className="p-2">{item.tagNo}</td>
                <td className="p-2">{item.description}</td>
                <td className="p-2 text-right tabular-nums">
                  {item.w1}×{item.h1}×{item.length}
                </td>
                <td className="p-2 text-right tabular-nums font-semibold">{item.quantity}</td>
                <td className="p-2 text-right tabular-nums">{item.area.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Dispatch Accessories ({acc.mode === 'entire_batch' ? 'Entire Batch' : 'Per Trip'})
            </h4>
          </div>
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-background border-b border-border text-text-secondary">
                <th className="p-2 text-left">Accessory</th>
                <th className="p-2 text-right">QTY</th>
                <th className="p-2 text-left">UNITS</th>
                <th className="p-2 text-left">Included</th>
              </tr>
            </thead>
            <tbody>
              {accessoryRows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="p-2 font-semibold">{row.label}</td>
                  <td className="p-2 text-right tabular-nums font-bold">
                    {row.included ? row.quantity : '—'}
                  </td>
                  <td className="p-2 text-text-secondary">NOS</td>
                  <td className="p-2">
                    {row.included ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                        <Check className="w-3.5 h-3.5" /> Included
                      </span>
                    ) : (
                      <span className="text-xs text-text-secondary">Not included</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm tabular-nums border-t border-border pt-4">
          <div>
            <span className="text-text-secondary">Current Dispatch Qty</span>
            <p className="font-bold">{dispatch.totalQuantity}</p>
          </div>
          <div>
            <span className="text-text-secondary">Current Dispatch Area</span>
            <p className="font-bold">{formatArea(dispatch.totalArea)}</p>
          </div>
          <div>
            <span className="text-text-secondary">Total Order Qty</span>
            <p className="font-semibold">{order.totalQuantity}</p>
          </div>
          <div>
            <span className="text-text-secondary">Total Dispatched</span>
            <p className="font-semibold text-success">{getOrderDispatchedQty(order)}</p>
          </div>
          <div>
            <span className="text-text-secondary">Balance Qty</span>
            <p className="font-semibold text-warning">{getOrderBalanceQty(order)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mt-8 pt-6 border-t border-border text-center text-sm">
          <div>
            <p className="text-text-secondary mb-8">Prepared By</p>
            <div className="border-t border-border pt-2" />
          </div>
          <div>
            <p className="text-text-secondary mb-8">Driver</p>
            <div className="border-t border-border pt-2" />
          </div>
          <div>
            <p className="text-text-secondary mb-8">Received By</p>
            <div className="border-t border-border pt-2" />
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => shareWhatsApp(generateWhatsAppMessage(dispatch, order))}
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const { subject, body } = generateEmailContent(dispatch, order)
            shareEmail(subject, body)
          }}
        >
          <Mail className="w-4 h-4" /> Email
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={downloadingPdf}
          onClick={async () => {
            if (downloadingPdf) return
            setDownloadingPdf(true)
            try {
              await generateDispatchPDF(dispatch, order)
            } finally {
              setDownloadingPdf(false)
            }
          }}
        >
          {downloadingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> PDF…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" /> PDF
            </>
          )}
        </Button>
      </div>

      {pendingStatus && (
        <WorkflowConfirmModal
          open={Boolean(pendingStatus)}
          title={`Update Dispatch Status to ${DISPATCH_STATUS_ACTIONS.find((a) => a.status === pendingStatus)?.label ?? pendingStatus}`}
          description={`Are you sure you want to transition this dispatch trip to "${DISPATCH_STATUS_ACTIONS.find((a) => a.status === pendingStatus)?.label ?? pendingStatus}"? This updates the live delivery progress.`}
          confirmText="Confirm Status Update"
          variant="primary"
          busy={updatingStatus}
          onConfirm={handleExecuteStatusUpdate}
          onClose={() => setPendingStatus(null)}
        />
      )}

      <StepSuccessModal
        open={successModal.open}
        onClose={() => setSuccessModal((prev) => ({ ...prev, open: false }))}
        title={successModal.title}
        message={successModal.message}
      />
    </div>
  )
}
