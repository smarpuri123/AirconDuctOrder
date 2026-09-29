import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, FileText, Mail, MessageCircle, Download } from 'lucide-react'
import { dispatchService } from '@/services/dispatchService'
import { orderService } from '@/services/orderService'
import { formatArea, getOrderBalanceQty } from '@/lib/calculations'
import { generateWhatsAppMessage, shareWhatsApp, generateEmailContent, shareEmail, generateDispatchPDF } from '@/lib/share'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function DispatchConfirmPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = dispatchService.getDispatchById(id!)
  const order = dispatch ? orderService.getOrderById(dispatch.orderId) : undefined

  if (!dispatch || !order) {
    return <p className="text-text-secondary">Dispatch not found.</p>
  }

  const balance = getOrderBalanceQty(order)

  const handleWhatsApp = () => {
    shareWhatsApp(generateWhatsAppMessage(dispatch, order))
  }

  const handleEmail = () => {
    const { subject, body } = generateEmailContent(dispatch, order)
    shareEmail(subject, body)
  }

  const handlePDF = () => {
    generateDispatchPDF(dispatch, order)
  }

  return (
    <div className="space-y-8 max-w-lg mx-auto text-center">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-semibold">Dispatch Created</h2>
      </div>

      <Card>
        <dl className="space-y-3 text-left">
          <div className="flex justify-between"><dt className="text-text-secondary">Dispatch No</dt><dd className="font-bold text-primary">{dispatch.dispatchNo}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Order</dt><dd className="font-medium">{order.orderNo}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Vehicle</dt><dd className="font-medium">{dispatch.vehicle.vehicleNumber}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Quantity</dt><dd className="font-bold tabular-nums">{dispatch.totalQuantity}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Area</dt><dd className="font-bold tabular-nums">{formatArea(dispatch.totalArea)}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Balance</dt><dd className="font-bold tabular-nums text-warning">{balance} Qty</dd></div>
        </dl>
      </Card>

      {balance === 0 && (
        <div className="bg-success-bg text-success rounded-md py-3 px-4 font-semibold">
          ✓ ORDER FULLY DISPATCHED
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
        <Button variant="secondary" onClick={handlePDF}>
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>

      <Button variant="ghost" onClick={() => navigate(`/orders/${order.id}`)}>
        Back to Order
      </Button>
    </div>
  )
}
