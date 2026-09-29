import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiData } from '@/hooks/useApiData'
import { ClipboardCheck, ClipboardList, FileText, Factory, Package, Plus, Truck } from 'lucide-react'
import { PageToolbar } from '@/components/layout/PageToolbar'
import { enquiryService } from '@/services/enquiryService'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SimpleWorkflowStepper } from '@/components/operations/SimpleWorkflowStepper'
import { StageChip } from '@/components/operations/StageChip'
import { DispatchStatusChip } from '@/components/ui/Chip'
import { formatDate } from '@/lib/calculations'
import { computeWorkQueueSnapshot, productionSubtext } from '@/lib/workQueue'

export function DashboardPage() {
  const navigate = useNavigate()
  const dataTick = useApiData()

  const stats = useMemo(() => enquiryService.getDashboardStats(), [dataTick])
  const queue = useMemo(() => computeWorkQueueSnapshot().breakdown, [dataTick])
  const allEnquiries = useMemo(() => enquiryService.getEnquiries(), [dataTick])
  const featured = useMemo(
    () =>
      allEnquiries[0] ? enquiryService.getEnquiryWithLiveStage(allEnquiries[0].id) : undefined,
    [allEnquiries, dataTick],
  )

  const inProductionOrders = queue.productionNotApproved + queue.productionInProgress
  const featuredOrder = featured?.orderId ? orderService.getOrderById(featured.orderId) : undefined
  const recentEnquiries = useMemo(() => enquiryService.getEnquiries().slice(0, 4), [dataTick])
  const recentDispatches = useMemo(() => dispatchService.getRecentDispatches(3), [dataTick])

  const steps = featured ? enquiryService.getWorkflowSteps(featured) : []

  return (
    <div className="space-y-8">
      <PageToolbar
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => navigate('/enquiries')}>
              <FileText className="w-4 h-4" />
              All Enquiries
            </Button>
            <Button size="sm" onClick={() => navigate('/enquiries/new')}>
              <Plus className="w-4 h-4" />
              New Enquiry
            </Button>
          </>
        }
      />

      <div>
        <p className="text-text-secondary">ECOVENT Operations</p>
        <h2 className="text-2xl font-semibold mt-1">Enquiry to Dispatch</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-stretch">
        <StatCard
          label="Enquiries"
          value={stats.newEnquiries}
          icon={FileText}
          subtext={queue.enquiryNotStarted ? `${queue.enquiryNotStarted} not started` : undefined}
        />
        <StatCard
          label="Design Review"
          value={stats.inDesign}
          icon={ClipboardList}
          subtext={queue.designReviewAction ? `${queue.designReviewAction} need action` : undefined}
        />
        <StatCard
          label="Approval Processing"
          value={stats.inApprovalProcessing}
          icon={ClipboardCheck}
          subtext={queue.accountsApprovalAction ? `${queue.accountsApprovalAction} awaiting accounts` : undefined}
        />
        <StatCard
          label="In Production"
          value={inProductionOrders}
          icon={Factory}
          subtext={productionSubtext(queue)}
        />
        <StatCard
          label="Ready to Dispatch"
          value={queue.ordersReadyToDispatch}
          icon={Package}
          subtext={
            queue.ordersReadyToDispatch > 0
              ? `${queue.ordersReadyToDispatch} open orders with dispatch balance`
              : undefined
          }
        />
        <StatCard label="Completed" value={stats.completed} icon={Truck} />
      </div>

      {featured && (
        <Card statusBorder="primary">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold">{featured.projectName}</h3>
              <p className="text-text-secondary">{featured.customerName} · {featured.enquiryNo}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/enquiries/${featured.id}`)}>
              Open Enquiry
            </Button>
          </div>
          <SimpleWorkflowStepper steps={steps} />
          {featuredOrder && (
            <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-border">
              <div>
                <p className="text-sm text-text-secondary">Ordered</p>
                <p className="text-2xl font-bold tabular-nums">{featuredOrder.totalQuantity}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Dispatched</p>
                <p className="text-2xl font-bold tabular-nums text-success">{getOrderDispatchedQty(featuredOrder)}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Balance</p>
                <p className="text-2xl font-bold tabular-nums text-warning">{getOrderBalanceQty(featuredOrder)}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Enquiries</h3>
          <Card padding="sm">
            <div className="divide-y divide-border">
              {recentEnquiries.map((e) => {
                const stage = e.orderId ? enquiryService.syncStageFromOrder(e) : e.stage
                return (
                  <button
                    key={e.id}
                    onClick={() => navigate(`/enquiries/${e.id}`)}
                    className="w-full py-3 px-2 flex justify-between text-left hover:bg-background rounded-md transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{e.enquiryNo}</p>
                      <p className="text-xs text-text-secondary">{e.projectName}</p>
                    </div>
                    <StageChip stage={stage} />
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Dispatches</h3>
          <Card padding="sm">
            <div className="divide-y divide-border">
              {recentDispatches.map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/dispatch/${d.id}`)}
                  className="w-full py-3 px-2 flex justify-between text-left hover:bg-background rounded-md transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{d.dispatchNo}</p>
                    <p className="text-xs text-text-secondary">{d.orderNo} · {formatDate(d.dispatchDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">{d.totalQuantity} Qty</span>
                    <DispatchStatusChip status={d.status} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
