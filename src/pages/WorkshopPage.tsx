import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useApiData } from '@/hooks/useApiData'
import { formatArea, formatDate, getOrderDispatchedQty } from '@/lib/calculations'
import { loadEnquiryWorkflowBoard } from '@/lib/operationsFlow/loadWorkflowBoard'
import { resolveWorkflowDisplayStage } from '@/lib/operationsWorkflow'
import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { orderService } from '@/services/orderService'
import { EnquiryWorkflowRadial } from '@/components/operationsFlow/EnquiryWorkflowRadial'
import {
  EnquiryWorkflowStagePanel,
  type WorkflowPanelSelection,
} from '@/components/operationsFlow/EnquiryWorkflowStagePanel'

const COMPLETED_PAGE_SIZE = 5

interface CompletedWorkshopOrderRow {
  orderId: string
  orderNo: string
  enquiryId?: string
  enquiryNo?: string
  customerName: string
  projectName?: string
  tripCount: number
  latestDispatchNo?: string
  deliveredQty: number
  totalQty: number
  totalArea: number
  completedAt: string
}

/** Live floor snapshot — radial enquiry tracks (separate from the KPI dashboard). */
export function WorkshopPage() {
  const navigate = useNavigate()
  const dataTick = useApiData()
  const [refreshKey, setRefreshKey] = useState(0)
  const [panelSelection, setPanelSelection] = useState<WorkflowPanelSelection>(null)
  const [completedPage, setCompletedPage] = useState(1)

  const { workflowBoard, completedOrders } = useMemo(() => {
    const board = loadEnquiryWorkflowBoard()
    const rows = board.rows.filter((row) => {
      const enquiry = enquiryService.getEnquiryById(row.enquiryId)
      if (!enquiry) return false
      return resolveWorkflowDisplayStage(enquiry) !== 'completed'
    })

    const allOrders = orderService.getOrders()
    const allDispatches = dispatchService.getDispatches()

    const completed: CompletedWorkshopOrderRow[] = allOrders
      .filter((order) => order.status === 'fully_dispatched' || order.status === 'closed')
      .map((order) => {
        const enquiry = enquiryService.getEnquiryByOrderId(order.id)
        const orderTrips = allDispatches
          .filter((d) => d.orderId === order.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        const completedActivity = enquiry?.activity.find(
          (a) => a.phase === 'dispatch' && /delivery completed/i.test(a.title),
        )
        const completedAt =
          completedActivity?.timestamp ??
          orderTrips[0]?.dispatchDate ??
          orderTrips[0]?.createdAt ??
          order.productionDate ??
          order.createdAt

        return {
          orderId: order.id,
          orderNo: order.orderNo,
          enquiryId: enquiry?.id,
          enquiryNo: enquiry?.enquiryNo,
          customerName: order.customerName,
          projectName: enquiry?.projectName,
          tripCount: orderTrips.length,
          latestDispatchNo: orderTrips[0]?.dispatchNo,
          deliveredQty: getOrderDispatchedQty(order),
          totalQty: order.totalQuantity,
          totalArea: order.totalArea,
          completedAt,
        }
      })
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

    return {
      workflowBoard: { ...board, rows },
      completedOrders: completed,
    }
  }, [dataTick, refreshKey])

  const totalCompletedPages = Math.max(1, Math.ceil(completedOrders.length / COMPLETED_PAGE_SIZE))

  useEffect(() => {
    if (completedPage > totalCompletedPages) {
      setCompletedPage(totalCompletedPages)
    }
  }, [completedPage, totalCompletedPages])

  const currentCompletedPage = Math.min(completedPage, totalCompletedPages)
  const pagedCompletedOrders = useMemo(() => {
    const start = (currentCompletedPage - 1) * COMPLETED_PAGE_SIZE
    return completedOrders.slice(start, start + COMPLETED_PAGE_SIZE)
  }, [completedOrders, currentCompletedPage])

  const isEmpty = workflowBoard.rows.length === 0

  return (
    <div className="space-y-3 pb-2">
      {isEmpty ? (
        <Card className="py-12 text-center text-text-secondary">No active enquiries on the floor.</Card>
      ) : (
        <EnquiryWorkflowRadial board={workflowBoard} onSelect={setPanelSelection} />
      )}

      <p className="text-[11px] text-text-secondary">
        Updated {new Date(workflowBoard.generatedAt).toLocaleString()} · {workflowBoard.rows.length}{' '}
        ring{workflowBoard.rows.length === 1 ? '' : 's'}
      </p>

      <Card padding="sm">
        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <h3 className="text-sm font-semibold text-text-primary truncate">
              Completed Dispatch Orders
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success">
              {completedOrders.length}
            </span>
          </div>

          {completedOrders.length > COMPLETED_PAGE_SIZE && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary shrink-0">
              <span>
                {(currentCompletedPage - 1) * COMPLETED_PAGE_SIZE + 1}–
                {Math.min(currentCompletedPage * COMPLETED_PAGE_SIZE, completedOrders.length)} of{' '}
                {completedOrders.length}
              </span>
              <button
                type="button"
                disabled={currentCompletedPage <= 1}
                onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-border hover:bg-background disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-medium text-text-primary tabular-nums">
                {currentCompletedPage} / {totalCompletedPages}
              </span>
              <button
                type="button"
                disabled={currentCompletedPage >= totalCompletedPages}
                onClick={() => setCompletedPage((p) => Math.min(totalCompletedPages, p + 1))}
                className="p-1 rounded border border-border hover:bg-background disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {completedOrders.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-6">
            No completed dispatch orders yet.
          </p>
        ) : (
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="border-b border-border text-text-secondary text-left">
                <th className="py-2 px-2 font-semibold w-[25%]">Order / Enquiry</th>
                <th className="py-2 px-2 font-semibold w-[23%]">Customer &amp; Project</th>
                <th className="py-2 px-2 font-semibold w-[13%] text-center">Trips</th>
                <th className="py-2 px-2 font-semibold w-[11%] text-right">Delivered Qty</th>
                <th className="py-2 px-2 font-semibold w-[11%] text-right">Area</th>
                <th className="py-2 px-2 font-semibold w-[10%] text-right">Completed</th>
                <th className="py-2 px-2 font-semibold w-[7%] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {pagedCompletedOrders.map((row) => (
                <tr
                  key={row.orderId}
                  onClick={() => navigate(`/orders/${row.orderId}`)}
                  className="hover:bg-background/60 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-2 truncate">
                    <p className="font-semibold text-primary truncate" title={row.orderNo}>
                      {row.orderNo}
                    </p>
                    {row.enquiryNo && (
                      <p className="text-[11px] text-text-secondary truncate" title={row.enquiryNo}>
                        {row.enquiryNo}
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-2 truncate">
                    <p className="font-medium text-text-primary truncate" title={row.customerName}>
                      {row.customerName}
                    </p>
                    {row.projectName && (
                      <p
                        className="text-[11px] text-text-secondary truncate"
                        title={row.projectName}
                      >
                        {row.projectName}
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center truncate">
                    <span className="font-semibold text-text-primary tabular-nums">
                      {row.tripCount} {row.tripCount === 1 ? 'trip' : 'trips'}
                    </span>
                    {row.latestDispatchNo && (
                      <p className="text-[11px] text-text-secondary font-mono truncate">
                        {row.latestDispatchNo}
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold tabular-nums text-success">
                    {row.deliveredQty}/{row.totalQty}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-text-primary">
                    {formatArea(row.totalArea)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-text-secondary">
                    {formatDate(row.completedAt)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success-bg text-success">
                      Delivered
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <EnquiryWorkflowStagePanel
        selection={panelSelection}
        onClose={() => setPanelSelection(null)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
