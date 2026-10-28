import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, CheckCircle, FileText, Mail, MessageCircle, Download, Loader2 } from 'lucide-react'
import { dispatchService } from '@/services/dispatchService'
import { orderService } from '@/services/orderService'
import { enquiryService } from '@/services/enquiryService'
import { formatArea, getOrderBalanceQty } from '@/lib/calculations'
import { resolveDispatchAccessories } from '@/lib/dispatchAccessories'
import { normalizeDispatchStatus } from '@/lib/dispatchWorkflow'
import {
  generateWhatsAppMessage,
  shareWhatsApp,
  generateEmailContent,
  shareEmail,
  generateDispatchPDF,
} from '@/lib/share'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DispatchStatusChip } from '@/components/ui/Chip'

export function DispatchConfirmPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = dispatchService.getDispatchById(id!)
  const order = dispatch ? orderService.getOrderById(dispatch.orderId) : undefined
  const enquiry = order ? enquiryService.getEnquiryByOrderId(order.id) : undefined

  if (!dispatch || !order) {
    return <p className="text-text-secondary">Dispatch not found.</p>
  }

  const balance = getOrderBalanceQty(order)
  const rawStatus = normalizeDispatchStatus(dispatch.status)
  const effectiveStatus =
    rawStatus === 'loading' && dispatch.items.length > 0 ? 'loaded' : rawStatus

  const acc = resolveDispatchAccessories(dispatch, order, enquiry?.ductLines)
  const includedAccessories = [
    { label: 'CORNNER', ...acc.corner },
    { label: 'N/BOLT', ...acc.nBolt },
    { label: 'CLEAT', ...acc.cleat },
  ].filter((r) => r.included)

  const handleWhatsApp = () => {
    shareWhatsApp(generateWhatsAppMessage(dispatch, order))
  }

  const handleEmail = () => {
    const { subject, body } = generateEmailContent(dispatch, order)
    shareEmail(subject, body)
  }

  const [generatingPdf, setGeneratingPdf] = useState(false)

  const handlePDF = async () => {
    if (generatingPdf) return
    setGeneratingPdf(true)
    try {
      await generateDispatchPDF(dispatch, order)
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="space-y-8 max-w-lg mx-auto text-center">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Vehicle Loaded — Ready to Deliver</h2>
        <DispatchStatusChip status={effectiveStatus} />
      </div>

      <Card>
        <dl className="space-y-3 text-left">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Dispatch No</dt>
            <dd className="font-bold text-primary">{dispatch.dispatchNo}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Order</dt>
            <dd className="font-medium">{order.orderNo}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Vehicle</dt>
            <dd className="font-medium">{dispatch.vehicle.vehicleNumber}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Quantity</dt>
            <dd className="font-bold tabular-nums">{dispatch.totalQuantity}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Area</dt>
            <dd className="font-bold tabular-nums">{formatArea(dispatch.totalArea)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Balance</dt>
            <dd className="font-bold tabular-nums text-warning">{balance} Qty</dd>
          </div>
        </dl>

        {includedAccessories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
              Accessories Included ({acc.mode === 'entire_batch' ? 'Entire Batch' : 'Per Trip'})
            </p>
            <div className="space-y-1.5 text-sm">
              {includedAccessories.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Check className="w-4 h-4 text-success" /> {r.label}
                  </span>
                  <span className="font-bold tabular-nums">{r.quantity} NOS</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {balance === 0 && (
        <div
          className={`${
            order.status === 'fully_dispatched'
              ? 'bg-success-bg text-success'
              : 'bg-primary/10 text-primary'
          } rounded-md py-3 px-4 font-semibold text-sm`}
        >
          {order.status === 'fully_dispatched'
            ? '✓ ORDER FULLY DELIVERED'
            : 'All order quantities loaded — mark trips Delivered to complete order'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => navigate(`/dispatch/${dispatch.id}`)}>
          <FileText className="w-4 h-4" />
          View Note
        </Button>
        <Button variant="secondary" onClick={handleWhatsApp}>
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </Button>
        <Button variant="secondary" onClick={handleEmail}>
          <Mail className="w-4 h-4" />
          Email
        </Button>
        <Button variant="secondary" onClick={handlePDF} disabled={generatingPdf}>
          {generatingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Generating PDF…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PDF
            </>
          )}
        </Button>
      </div>

      <Button variant="ghost" onClick={() => navigate(`/orders/${order.id}`)}>
        Back to Order
      </Button>
    </div>
  )
}
