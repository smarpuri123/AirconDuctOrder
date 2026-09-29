import { useState } from 'react'

import { useParams, useNavigate } from 'react-router-dom'

import { ArrowLeft, Truck } from 'lucide-react'

import { orderService } from '@/services/orderService'

import { dispatchService } from '@/services/dispatchService'

import { enquiryService } from '@/services/enquiryService'

import { ActivityTimeline } from '@/components/operations/ActivityTimeline'

import { WorkflowProgressSummary } from '@/components/operations/WorkflowProgressSummary'

import {

  formatArea,

  formatDimensions,

  getItemBalance,

  getOrderBalanceArea,

  getOrderBalanceQty,

  getOrderDispatchedQty,

} from '@/lib/calculations'

import { Card } from '@/components/ui/Card'

import { Button } from '@/components/ui/Button'

import { OrderStatusChip } from '@/components/ui/Chip'

import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProductionProcessPanel } from '@/components/operations/ProductionProcessPanel'
import type { ProductionProcess } from '@/types/production'

import { DispatchTimeline } from '@/components/dispatch/DispatchTimeline'



export function OrderDetailPage() {

  const { id } = useParams<{ id: string }>()

  const navigate = useNavigate()

  const [, setVersion] = useState(0)

  const [busyProcess, setBusyProcess] = useState<ProductionProcess | null>(null)
  const [formError, setFormError] = useState('')

  const order = orderService.getOrderById(id!)

  const dispatches = dispatchService.getDispatchesByOrderId(id!)

  const enquiry = enquiryService.getEnquiryByOrderId(id!)



  if (!order) {

    return <p className="text-text-secondary">Order not found.</p>

  }



  const dispatchedQty = getOrderDispatchedQty(order)

  const balanceQty = getOrderBalanceQty(order)

  const inProduction = order.status === 'production'

  const canDispatch = balanceQty > 0 && !inProduction

  const productionApproved = order.productionApproved ?? false

  const reload = () => setVersion((v) => v + 1)



  const handleApproveProduction = async () => {
    setFormError('')
    try {
      await orderService.approveProductionStart(order.id)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to approve production')
    }
  }

  const handleCompleteProcess = async (process: ProductionProcess) => {
    setFormError('')
    setBusyProcess(process)
    try {
      await orderService.completeProductionProcess(order.id, process)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update production process')
    } finally {
      setBusyProcess(null)
    }
  }

  const handleMarkReady = async () => {
    setFormError('')
    try {
      await orderService.markProductionReady(order.id)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to mark ready')
    }
  }



  return (

    <div className="space-y-6">

      <button

        onClick={() => navigate('/orders')}

        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"

      >

        <ArrowLeft className="w-4 h-4" />

        Back to Orders

      </button>



      <div className="flex items-start justify-between">

        <div>

          <h2 className="text-2xl font-semibold">{order.jobName}</h2>

          <p className="text-text-secondary">{order.customerName}</p>

          {enquiry && (

            <button

              onClick={() => navigate(`/enquiries/${enquiry.id}`)}

              className="text-sm text-primary hover:underline mt-1"

            >

              From {enquiry.enquiryNo}

            </button>

          )}

        </div>

        <OrderStatusChip status={order.status} />

      </div>



      {enquiry && enquiry.activity.length > 0 && (

        <Card>

          <h3 className="font-semibold mb-4">Delivery Progress</h3>

          <WorkflowProgressSummary entries={enquiry.activity} />

        </Card>

      )}



      <Card>

        <h3 className="font-semibold mb-4">Manufacturing</h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-4">
          <div>
            <p className="text-sm text-text-secondary">Ordered</p>
            <p className="text-2xl font-bold tabular-nums">{order.totalQuantity}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Dispatched</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{dispatchedQty}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Area</p>
            <p className="text-2xl font-bold tabular-nums">{formatArea(order.totalArea)}</p>
          </div>
        </div>

        <ProgressBar value={dispatchedQty} max={order.totalQuantity} label="Dispatch Progress" />

        <ProductionProcessPanel
          order={order}
          productionApproved={productionApproved}
          inProduction={inProduction}
          onApproveProduction={handleApproveProduction}
          onCompleteProcess={handleCompleteProcess}
          onMarkReady={handleMarkReady}
          busyProcess={busyProcess}
        />

        {formError && <p className="text-error text-sm mt-4">{formError}</p>}
      </Card>



      <Card>

        <h3 className="font-semibold mb-4">Dispatch</h3>

        <div className="grid grid-cols-3 gap-6 mb-4">

          <div>

            <p className="text-sm text-text-secondary">Dispatched</p>

            <p className="text-2xl font-bold tabular-nums text-success">{dispatchedQty}</p>

          </div>

          <div>

            <p className="text-sm text-text-secondary">Balance</p>

            <p className="text-2xl font-bold tabular-nums text-warning">{balanceQty}</p>

          </div>

          <div>

            <p className="text-sm text-text-secondary">Trips</p>

            <p className="text-2xl font-bold tabular-nums">{dispatches.length}</p>

          </div>

        </div>

        <ProgressBar value={dispatchedQty} max={order.totalQuantity} label="Dispatch Progress" />

        <p className="text-sm text-text-secondary mt-2 tabular-nums">

          Balance area: {formatArea(getOrderBalanceArea(order))}

        </p>

        {canDispatch && (

          <Button className="mt-6" onClick={() => navigate(`/orders/${order.id}/dispatch`)}>

            <Truck className="w-4 h-4" />

            Create Dispatch Trip {dispatches.length + 1}

          </Button>

        )}

      </Card>



      <div>

        <h3 className="font-semibold mb-4">Duct Items</h3>

        <div className="space-y-3">

          {order.items.map((item) => (

            <Card key={item.id} padding="sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="font-semibold">Tag {item.tagNo}</p>

                  <p className="text-sm text-text-secondary">{formatDimensions(item)}</p>

                  <p className="text-xs text-text-secondary">L: {item.length} · {item.description}</p>

                </div>

                <div className="text-right text-sm tabular-nums">

                  <p>Ordered: <span className="font-semibold">{item.orderedQty}</span></p>

                  <p>Ready: <span className="font-semibold text-primary">{item.readyQty}</span></p>

                  <p>Dispatched: <span className="font-semibold text-success">{item.dispatchedQty}</span></p>

                  <p>Balance: <span className="font-semibold text-warning">{getItemBalance(item)}</span></p>

                </div>

              </div>

            </Card>

          ))}

        </div>

      </div>



      <div>

        <h3 className="font-semibold mb-4">Dispatch History</h3>

        <Card>

          <DispatchTimeline order={order} dispatches={dispatches} />

        </Card>

      </div>



      {enquiry && (

        <Card>

          <h3 className="font-semibold mb-4">Activity History</h3>

          <ActivityTimeline entries={enquiry.activity} />

        </Card>

      )}

    </div>

  )

}


