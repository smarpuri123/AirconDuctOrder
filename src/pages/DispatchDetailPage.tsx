import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Mail, MessageCircle } from 'lucide-react'
import { dispatchService } from '@/services/dispatchService'
import { orderService } from '@/services/orderService'
import { formatArea, formatDate, getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'
import { generateWhatsAppMessage, shareWhatsApp, generateEmailContent, shareEmail, generateDispatchPDF } from '@/lib/share'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DispatchStatusChip } from '@/components/ui/Chip'

export function DispatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = dispatchService.getDispatchById(id!)
  const order = dispatch ? orderService.getOrderById(dispatch.orderId) : undefined

  if (!dispatch || !order) {
    return <p className="text-text-secondary">Dispatch not found.</p>
  }

  const isConfirm = window.location.pathname.endsWith('/confirm')

  return (
    <div className="space-y-6">
      {!isConfirm && (
        <button
          onClick={() => navigate('/dispatch')}
          className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dispatches
        </button>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Dispatch Note</h2>
          <p className="text-text-secondary">{dispatch.dispatchNo}</p>
        </div>
        <DispatchStatusChip status={dispatch.status} />
      </div>

      <Card>
        <div className="text-center border-b border-border pb-6 mb-6">
          <h3 className="text-lg font-bold text-primary">ECOVENT AIR SYSTEMS INDIA LLP</h3>
          <p className="text-sm text-text-secondary">Quality Ducts Is Our Business</p>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><dt className="text-text-secondary">Dispatch No</dt><dd className="font-semibold">{dispatch.dispatchNo}</dd></div>
          <div><dt className="text-text-secondary">Date</dt><dd className="font-semibold">{formatDate(dispatch.dispatchDate)}</dd></div>
          <div><dt className="text-text-secondary">Order No</dt><dd className="font-semibold">{order.orderNo}</dd></div>
          <div><dt className="text-text-secondary">Customer</dt><dd className="font-semibold">{order.customerName}</dd></div>
          <div><dt className="text-text-secondary">Vehicle</dt><dd className="font-semibold">{dispatch.vehicle.vehicleNumber}</dd></div>
          <div><dt className="text-text-secondary">Driver</dt><dd className="font-semibold">{dispatch.vehicle.driverName}</dd></div>
        </dl>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-primary text-white">
              <th className="p-2 text-left">Tag</th>
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
                <td className="p-2 text-right tabular-nums">{item.w1}×{item.h1}×{item.length}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{item.quantity}</td>
                <td className="p-2 text-right tabular-nums">{item.area.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-4 text-sm tabular-nums border-t border-border pt-4">
          <div><span className="text-text-secondary">Current Dispatch Qty</span><p className="font-bold">{dispatch.totalQuantity}</p></div>
          <div><span className="text-text-secondary">Current Dispatch Area</span><p className="font-bold">{formatArea(dispatch.totalArea)}</p></div>
          <div><span className="text-text-secondary">Total Order Qty</span><p className="font-semibold">{order.totalQuantity}</p></div>
          <div><span className="text-text-secondary">Total Dispatched</span><p className="font-semibold text-success">{getOrderDispatchedQty(order)}</p></div>
          <div><span className="text-text-secondary">Balance Qty</span><p className="font-semibold text-warning">{getOrderBalanceQty(order)}</p></div>
        </div>

        <div className="grid grid-cols-3 gap-8 mt-8 pt-6 border-t border-border text-center text-sm">
          <div><p className="text-text-secondary mb-8">Prepared By</p><div className="border-t border-border pt-2" /></div>
          <div><p className="text-text-secondary mb-8">Driver</p><div className="border-t border-border pt-2" /></div>
          <div><p className="text-text-secondary mb-8">Received By</p><div className="border-t border-border pt-2" /></div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={() => shareWhatsApp(generateWhatsAppMessage(dispatch, order))}>
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </Button>
        <Button variant="secondary" size="sm" onClick={() => { const { subject, body } = generateEmailContent(dispatch, order); shareEmail(subject, body) }}>
          <Mail className="w-4 h-4" /> Email
        </Button>
        <Button variant="secondary" size="sm" onClick={() => generateDispatchPDF(dispatch, order)}>
          <Download className="w-4 h-4" /> PDF
        </Button>
      </div>
    </div>
  )
}
