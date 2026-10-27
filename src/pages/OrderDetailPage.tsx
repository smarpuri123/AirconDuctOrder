import { useState } from 'react'

import { useParams, useNavigate } from 'react-router-dom'

import { ArrowLeft, RotateCcw, Truck } from 'lucide-react'

import { orderService } from '@/services/orderService'

import { dispatchService } from '@/services/dispatchService'

import { enquiryService } from '@/services/enquiryService'

import { ActivityTimeline } from '@/components/operations/ActivityTimeline'

import { WorkflowProgressSummary } from '@/components/operations/WorkflowProgressSummary'
import { canRevertOrderStepUi, orderRevertStepLabel } from '@/lib/orderWorkflow'
import { canManageProductionOnEnquiry } from '@/lib/portalAccess'
import { WorkflowConfirmModal, StepSuccessModal } from '@/components/ui/WorkflowConfirmModal'

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
import type { ProductionTrackAction } from '@/lib/productionTrack'
import type { ProductionProcess } from '@/types/production'

import { DispatchTimeline } from '@/components/dispatch/DispatchTimeline'
import { useAppStore } from '@/store/appStore'
import { usePortalRoles } from '@/hooks/usePortalRoles'



export function OrderDetailPage() {

  const { id } = useParams<{ id: string }>()

  const navigate = useNavigate()

  const [, setVersion] = useState(0)

  const [busyProcess, setBusyProcess] = useState<ProductionProcess | null>(null)
  const [formError, setFormError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [confirmModalType, setConfirmModalType] = useState<'mark_ready' | 'revert_order' | null>(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [successModal, setSuccessModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  })

  const order = orderService.getOrderById(id!)

  const dispatches = dispatchService.getDispatchesByOrderId(id!)

  const enquiry = enquiryService.getEnquiryByOrderId(id!)

  const roles = usePortalRoles()
  const canRevertOrder =
    order && canManageProductionOnEnquiry(roles) ? canRevertOrderStepUi(order) : false

  if (!order) {

    return <p className="text-text-secondary">Order not found.</p>

  }



  const dispatchedQty = getOrderDispatchedQty(order)

  const balanceQty = getOrderBalanceQty(order)

  const inProduction = order.status === 'production'

  const canDispatch = balanceQty > 0 && !inProduction

  const reload = () => setVersion((v) => v + 1)

  const handleTrackAction = async (
    process: ProductionProcess,
    action: ProductionTrackAction,
  ) => {
    setFormError('')
    setBusyProcess(process)
    try {
      await orderService.updateProductionTrack(order.id, process, action)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update production track')
    } finally {
      setBusyProcess(null)
    }
  }

  const handleMarkReady = () => {
    setFormError('')
    setConfirmModalType('mark_ready')
  }

  const handleExecuteConfirmedAction = async () => {
    if (!confirmModalType || actionBusy) return
    setFormError('')
    setActionBusy(true)
    const type = confirmModalType
    const note = confirmNote.trim()

    try {
      if (type === 'mark_ready') {
        await orderService.markProductionReady(order.id)
        setConfirmModalType(null)
        reload()
        setSuccessModal({
          open: true,
          title: 'Production Marked as Ready',
          message: 'The order has been marked ready for dispatch. Dispatch trips can now be scheduled.',
        })
      } else if (type === 'revert_order') {
        await orderService.revertOrderWorkflowStep(order.id, note)
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Production Stepped Back',
          message: 'Production order moved back to the previous workflow stage.',
        })
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to execute action')
    } finally {
      setActionBusy(false)
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



      {enquiry && (enquiry.activity.length > 0 || canRevertOrder) && (

        <Card>

          <h3 className="font-semibold mb-4">Workflow &amp; Delivery Progress</h3>

          {enquiry.activity.length > 0 && (
            <WorkflowProgressSummary entries={enquiry.activity} />
          )}

          {canRevertOrder && (
            <div className={`${enquiry.activity.length > 0 ? 'mt-5 pt-4 border-t border-border' : ''}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <RotateCcw className="w-4 h-4 text-warning" />
                <h4 className="text-sm font-semibold text-text-primary">Workflow Reversion &amp; Corrections</h4>
              </div>
              <p className="text-xs text-text-secondary mb-3">
                Need to roll back production stages? Use the option below to step back.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirmNote('')
                  setConfirmModalType('revert_order')
                }}
                disabled={actionBusy}
                className="border-warning/30 hover:bg-warning/10 text-warning"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                {orderRevertStepLabel(order)}
              </Button>
            </div>
          )}

        </Card>

      )}



      <Card>

        <h3 className="font-semibold mb-4">Manufacturing</h3>

        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <p className="text-sm text-text-secondary">Ordered Quantity</p>
            <p className="text-2xl font-bold tabular-nums">{order.totalQuantity}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Total Area</p>
            <p className="text-2xl font-bold tabular-nums">{formatArea(order.totalArea)}</p>
          </div>
        </div>

        <ProductionProcessPanel
          order={order}
          inProduction={inProduction}
          onTrackAction={handleTrackAction}
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

          <Button
            className="mt-6"
            onClick={() => {
              useAppStore.getState().setDispatchDraft(null)
              navigate(`/orders/${order.id}/dispatch`)
            }}
          >

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

                  <p className="font-semibold">Duct {item.tagNo}</p>

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

      {confirmModalType === 'mark_ready' && (
        <WorkflowConfirmModal
          open={Boolean(confirmModalType)}
          title="Mark Production Order as Ready"
          description="Confirm that all shop floor duct manufacturing lines are complete and this order is ready for dispatch?"
          confirmText="Confirm & Mark Ready"
          variant="primary"
          busy={actionBusy}
          onConfirm={handleExecuteConfirmedAction}
          onClose={() => setConfirmModalType(null)}
        />
      )}

      {confirmModalType === 'revert_order' && (
        <WorkflowConfirmModal
          open={Boolean(confirmModalType)}
          title={orderRevertStepLabel(order)}
          description="Step back the production order to the previous workflow stage?"
          confirmText="Confirm Step Back"
          variant="warning"
          busy={actionBusy}
          showNote={true}
          noteLabel="Production step-back note (optional)"
          notePlaceholder="Why is production moving back?"
          noteValue={confirmNote}
          onNoteChange={setConfirmNote}
          onConfirm={handleExecuteConfirmedAction}
          onClose={() => {
            setConfirmModalType(null)
            setConfirmNote('')
          }}
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


