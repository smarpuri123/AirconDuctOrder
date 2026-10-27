import type { Dispatch, Order } from '@/types'
import type { Enquiry } from '@/types/enquiry'
import { hasDuctScheduleImported } from '@/lib/enquiryWorkflow'
import {
  formatProductionActiveTime,
  getProductionTrackActiveSeconds,
  getProductionTrackStatus,
  PRODUCTION_TRACK_STATUS_LABELS,
} from '@/lib/productionTrack'
import { productionProcessesComplete } from '@/types/production'
import { compareEnquiryPriority } from './snapshotUtils'

export type WorkflowCellStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'blocked'
  | 'rejected'
  | 'on_hold'

export type WorkflowCellKind = 'design' | 'accounts' | 'production' | 'dispatch' | 'terminal'

export type WorkflowStageId =
  | 'design_assignment'
  | 'design_work'
  | 'design_handover'
  | 'quotation_prep'
  | 'quotation_approval'
  | 'quotation_submitted'
  | 'customer_approval'
  | 'ready_production'
  | 'production_flat'
  | 'production_plasma'
  | 'ready_dispatch'
  | 'order_complete'

export type WorkflowStageLayout = 'horizontal' | 'arc' | 'split' | 'marker'

export interface WorkflowStageCell {
  id: WorkflowStageId
  label: string
  shortLabel: string
  kind: WorkflowCellKind
  layout: WorkflowStageLayout
  status: WorkflowCellStatus
  revisionCount?: number
  assigneeName?: string
  startedAt?: string
  completedAt?: string
  detail?: string
}

export interface WorkflowDispatchNode {
  id: string
  dispatchNo: string
  status: Dispatch['status']
  vehicleType: string
  dispatchDate: string
  createdAt: string
  totalQuantity: number
  endedAt?: string
}

export interface EnquiryWorkflowRow {
  enquiryId: string
  enquiryNo: string
  projectName: string
  clientName: string
  priority: Enquiry['priority']
  revision: number
  orderId?: string
  orderNo?: string
  dispatchedQty: number
  totalOrderQty: number
  pendingDispatchQty: number
  cells: WorkflowStageCell[]
  dispatches: WorkflowDispatchNode[]
  dispatchSummaryStatus: WorkflowCellStatus
  activeStageId?: WorkflowStageId
}

export const ARC_STAGE_IDS: WorkflowStageId[] = [
  'quotation_prep',
  'quotation_approval',
  'quotation_submitted',
  'customer_approval',
  'ready_production',
  'production_flat',
  'ready_dispatch',
]

export const DESIGN_STAGE_IDS: WorkflowStageId[] = [
  'design_assignment',
  'design_work',
  'design_handover',
]

const DESIGN_STATUS_ORDER: Enquiry['designReview']['status'][] = [
  'pending',
  'in_review',
  'revision_needed',
  'submitted_to_accounts',
  'po_for_review',
  'po_for_approval',
  'approved',
]

function designStatusRank(status: Enquiry['designReview']['status']): number {
  const idx = DESIGN_STATUS_ORDER.indexOf(status)
  return idx === -1 ? 0 : idx
}

function activityTimestamp(
  enquiry: Enquiry,
  matcher: (title: string) => boolean,
): string | undefined {
  const hit = enquiry.activity
    .filter((a) => matcher(a.title))
    .map((a) => a.timestamp)
    .sort()
  return hit[hit.length - 1]
}

function stageRevisionCount(
  enquiry: Enquiry,
  status: WorkflowCellStatus,
  matcher?: (title: string) => boolean,
): number {
  const currentRev = Math.max(1, enquiry.designReview.revision ?? 1)
  if (status !== 'pending') return currentRev
  if (!matcher) return 0
  const activityRevs = enquiry.activity
    .filter((a) => matcher(a.title))
    .map((a) => a.revision ?? 1)
  return activityRevs.length > 0 ? Math.max(...activityRevs) : 0
}

function designCellStatuses(enquiry: Enquiry): WorkflowStageCell[] {
  const dr = enquiry.designReview
  const assignee = enquiry.currentAssigneeName ?? enquiry.personInChargeName

  const assignment: WorkflowCellStatus =
    dr.status === 'revision_needed' && !enquiry.currentAssigneeId
      ? 'blocked'
      : enquiry.currentAssigneeId || dr.status !== 'pending'
        ? dr.status === 'pending' && enquiry.currentAssigneeId
          ? 'active'
          : 'completed'
        : enquiry.stage === 'enquiry'
          ? 'pending'
          : 'active'

  const work: WorkflowCellStatus =
    dr.status === 'revision_needed'
      ? 'active'
      : designStatusRank(dr.status) < designStatusRank('in_review')
        ? 'pending'
        : dr.status === 'in_review'
          ? 'active'
          : 'completed'

  const handover: WorkflowCellStatus =
    designStatusRank(dr.status) < designStatusRank('submitted_to_accounts')
      ? 'pending'
      : dr.status === 'submitted_to_accounts'
        ? 'active'
        : 'completed'

  return [
    {
      id: 'design_assignment',
      label: 'Designer assignment',
      shortLabel: 'Assign',
      kind: 'design',
      layout: 'horizontal',
      status: assignment,
      revisionCount: stageRevisionCount(
        enquiry,
        assignment,
        (t) => /assigned to design|design in-charge/i.test(t),
      ),
      assigneeName: assignee,
      startedAt: activityTimestamp(enquiry, (t) => /assigned to design/i.test(t)),
      completedAt:
        assignment === 'completed'
          ? activityTimestamp(enquiry, (t) => /assigned to design|design in-charge/i.test(t))
          : undefined,
    },
    {
      id: 'design_work',
      label: 'Design extraction',
      shortLabel: 'Design',
      kind: 'design',
      layout: 'horizontal',
      status: work,
      revisionCount: stageRevisionCount(
        enquiry,
        work,
        (t) => /started working on the design|design updated|duct schedule imported|revision/i.test(t),
      ),
      assigneeName: assignee,
      startedAt: activityTimestamp(enquiry, (t) => /started working on the design/i.test(t)),
      completedAt: activityTimestamp(enquiry, (t) => /submitted to accounts/i.test(t)),
      detail:
        dr.ductTags != null
          ? `${dr.ductTags} tags · ${dr.totalQty ?? '—'} qty`
          : hasDuctScheduleImported(enquiry)
            ? 'Schedule imported'
            : undefined,
    },
    {
      id: 'design_handover',
      label: 'Handover to accounts',
      shortLabel: 'Handover',
      kind: 'design',
      layout: 'horizontal',
      status: handover,
      revisionCount: stageRevisionCount(
        enquiry,
        handover,
        (t) => /submitted to accounts/i.test(t),
      ),
      assigneeName: assignee,
      completedAt: activityTimestamp(enquiry, (t) => /submitted to accounts/i.test(t)),
    },
  ]
}

function accountsCell(
  id: WorkflowStageId,
  label: string,
  short: string,
  status: WorkflowCellStatus,
  enquiry: Enquiry,
  matcher: (title: string) => boolean,
): WorkflowStageCell {
  return {
    id,
    label,
    shortLabel: short,
    kind: 'accounts',
    layout: 'arc',
    status,
    revisionCount: stageRevisionCount(enquiry, status, matcher),
    assigneeName: enquiry.currentAssigneeName,
    startedAt: undefined,
    completedAt: status === 'completed' ? enquiry.designReview.reviewDate : undefined,
  }
}

function accountsAndProductionCells(
  enquiry: Enquiry,
  order: Order | undefined,
  dispatchedQty: number,
  totalOrderQty: number,
): WorkflowStageCell[] {
  const dr = enquiry.designReview
  const rank = designStatusRank(dr.status)

  const prep: WorkflowCellStatus =
    rank < designStatusRank('submitted_to_accounts')
      ? 'pending'
      : dr.status === 'submitted_to_accounts'
        ? 'active'
        : 'completed'

  const quotApproval: WorkflowCellStatus =
    rank < designStatusRank('po_for_review')
      ? 'pending'
      : dr.status === 'po_for_review'
        ? 'active'
        : 'completed'

  const submitted: WorkflowCellStatus =
    rank < designStatusRank('po_for_approval')
      ? 'pending'
      : dr.status === 'po_for_approval'
        ? 'active'
        : 'completed'

  const customer: WorkflowCellStatus =
    rank < designStatusRank('approved')
      ? 'pending'
      : dr.status === 'approved' || enquiry.orderId
        ? 'completed'
        : 'pending'

  let readyProd: WorkflowCellStatus = 'pending'
  if (enquiry.orderId && order) {
    if (order.status === 'draft' || order.status === 'imported') readyProd = 'active'
    else readyProd = 'completed'
  } else if (dr.status === 'approved') {
    readyProd = 'active'
  }

  const flatStatus = order ? mapProductionStatus(getProductionTrackStatus(order, 'straight_ducts')) : 'pending'
  const plasmaStatus = order ? mapProductionStatus(getProductionTrackStatus(order, 'plasma_ducts')) : 'pending'

  let productionGate: WorkflowCellStatus = 'pending'
  if (order?.status === 'production') productionGate = 'active'
  else if (order && order.status !== 'draft' && order.status !== 'imported') productionGate = 'completed'

  const flat: WorkflowCellStatus =
    productionGate === 'pending'
      ? 'pending'
      : flatStatus === 'pending' && productionGate === 'active'
        ? 'pending'
        : flatStatus
  const plasma: WorkflowCellStatus = productionGate === 'pending' ? 'pending' : plasmaStatus

  let readyDispatch: WorkflowCellStatus = 'pending'
  if (order) {
    if (
      dispatchedQty > 0 ||
      order.status === 'partially_dispatched' ||
      order.status === 'fully_dispatched' ||
      order.status === 'closed'
    ) {
      readyDispatch = 'completed'
    } else if (
      order.status === 'ready' ||
      (order.status === 'production' && productionProcessesComplete(order))
    ) {
      readyDispatch = 'active'
    }
  }

  const prodRev = Math.max(1, order?.revision ?? enquiry.designReview.revision ?? 1)
  const pendingQty = Math.max(0, totalOrderQty - dispatchedQty)

  return [
    accountsCell(
      'quotation_prep',
      'Quote preparation',
      'Quote prep',
      prep,
      enquiry,
      (t) => /submitted to accounts|po sent for review|quote submitted for review/i.test(t),
    ),
    accountsCell(
      'quotation_approval',
      'Quote review',
      'Quote rev',
      quotApproval,
      enquiry,
      (t) => /po sent for review|po pending approval|quote submitted for review|quote approved for client/i.test(t),
    ),
    accountsCell(
      'quotation_submitted',
      'Quote submitted to client',
      'Submitted',
      submitted,
      enquiry,
      (t) => /po pending approval|po approved|quote approved for client|quote approved by client/i.test(t),
    ),
    accountsCell(
      'customer_approval',
      'Client quote approval',
      'Approved',
      customer,
      enquiry,
      (t) => /po approved|quote approved by client|returned to design/i.test(t),
    ),
    {
      id: 'ready_production',
      label: 'Ready for production',
      shortLabel: 'RFP',
      kind: 'production',
      layout: 'arc',
      status: readyProd,
      revisionCount: readyProd !== 'pending' ? prodRev : 0,
      detail: order?.orderNo ? `Order ${order.orderNo}` : undefined,
      completedAt: order?.productionApprovedDate,
    },
    {
      id: 'production_flat',
      label: 'Flat (straight ducts)',
      shortLabel: 'Flat',
      kind: 'production',
      layout: 'split',
      status: flat,
      revisionCount: flat !== 'pending' ? prodRev : 0,
      startedAt: order?.straightDuctsRunStartedAt,
      completedAt: order?.straightDuctsCompletedAt,
      detail: order
        ? PRODUCTION_TRACK_STATUS_LABELS[getProductionTrackStatus(order, 'straight_ducts')]
        : undefined,
    },
    {
      id: 'production_plasma',
      label: 'Plasma ducts',
      shortLabel: 'Plasma',
      kind: 'production',
      layout: 'split',
      status: plasma,
      revisionCount: plasma !== 'pending' ? prodRev : 0,
      startedAt: order?.plasmaDuctsRunStartedAt,
      completedAt: order?.plasmaDuctsCompletedAt,
      detail: order
        ? `${PRODUCTION_TRACK_STATUS_LABELS[getProductionTrackStatus(order, 'plasma_ducts')]} · ${formatProductionActiveTime(getProductionTrackActiveSeconds(order, 'plasma_ducts'))}`
        : undefined,
    },
    {
      id: 'ready_dispatch',
      label: 'Ready for dispatch',
      shortLabel: 'RFD',
      kind: 'dispatch',
      layout: 'arc',
      status: readyDispatch,
      revisionCount: readyDispatch !== 'pending' ? prodRev : 0,
      detail:
        totalOrderQty > 0
          ? `${dispatchedQty}/${totalOrderQty} dispatched · ${pendingQty} pending`
          : undefined,
    },
  ]
}

function mapProductionStatus(
  track: ReturnType<typeof getProductionTrackStatus>,
): WorkflowCellStatus {
  if (track === 'completed') return 'completed'
  if (track === 'running') return 'active'
  if (track === 'paused') return 'on_hold'
  return 'pending'
}

function dispatchNodes(dispatches: Dispatch[], orderId: string | undefined): WorkflowDispatchNode[] {
  if (!orderId) return []
  return dispatches
    .filter((d) => d.orderId === orderId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((d) => ({
      id: d.id,
      dispatchNo: d.dispatchNo,
      status: d.status,
      vehicleType: d.vehicle.vehicleType,
      dispatchDate: d.dispatchDate,
      createdAt: d.createdAt,
      totalQuantity: d.totalQuantity,
      endedAt: d.status === 'delivered' ? d.dispatchDate : undefined,
    }))
}

function isOrderDeliveryComplete(
  order: Order | undefined,
  nodes: WorkflowDispatchNode[],
  dispatchedQty: number,
  totalOrderQty: number,
): boolean {
  if (!order) return false
  if (order.status === 'closed') return true
  if (totalOrderQty <= 0 || dispatchedQty < totalOrderQty) return false
  if (nodes.length > 0) {
    return nodes.every((n) => n.status === 'delivered')
  }
  return order.status === 'fully_dispatched'
}

function dispatchSummary(
  order: Order | undefined,
  nodes: WorkflowDispatchNode[],
  dispatchedQty: number,
  totalOrderQty: number,
): WorkflowCellStatus {
  if (!order) return 'pending'
  if (isOrderDeliveryComplete(order, nodes, dispatchedQty, totalOrderQty)) {
    return 'completed'
  }
  if (
    dispatchedQty > 0 ||
    nodes.length > 0 ||
    nodes.some((n) => n.status === 'loading' || n.status === 'loaded' || n.status === 'dispatched')
  ) {
    return 'active'
  }
  return 'pending'
}

function terminalCell(
  enquiry: Enquiry,
  order: Order | undefined,
  nodes: WorkflowDispatchNode[],
  dispatchedQty: number,
  totalOrderQty: number,
): WorkflowStageCell {
  const complete =
    isOrderDeliveryComplete(order, nodes, dispatchedQty, totalOrderQty) ||
    (!order && enquiry.stage === 'completed')
  const pendingQty = Math.max(0, totalOrderQty - dispatchedQty)
  const deliveredTrips = nodes.filter((n) => n.status === 'delivered').length

  return {
    id: 'order_complete',
    label: 'Order completion',
    shortLabel: 'Done',
    kind: 'terminal',
    layout: 'marker',
    status: complete ? 'completed' : 'pending',
    completedAt: complete ? enquiry.activity.find((a) => /completed/i.test(a.title))?.timestamp : undefined,
    detail:
      totalOrderQty > 0
        ? complete
          ? `All ${totalOrderQty}/${totalOrderQty} ducts dispatched`
          : pendingQty === 0 && nodes.length > 0
            ? `${dispatchedQty}/${totalOrderQty} loaded · ${deliveredTrips}/${nodes.length} trips delivered`
            : `${dispatchedQty}/${totalOrderQty} dispatched · ${pendingQty} pending`
        : undefined,
  }
}

function pickActiveStage(cells: WorkflowStageCell[]): WorkflowStageId | undefined {
  const active = cells.find((c) => c.status === 'active' || c.status === 'on_hold' || c.status === 'rejected')
  return active?.id
}

export function buildEnquiryWorkflowRow(
  enquiry: Enquiry,
  order: Order | undefined,
  dispatches: Dispatch[],
): EnquiryWorkflowRow {
  const dispatchList = dispatchNodes(dispatches, enquiry.orderId)
  const totalOrderQty = order
    ? order.totalQuantity
    : (enquiry.designReview.totalQty ?? 0)
  const itemDispatchedQty = order
    ? order.items.reduce((s, item) => s + item.dispatchedQty, 0)
    : 0
  const tripDispatchedQty = dispatchList.reduce((s, d) => s + d.totalQuantity, 0)
  const dispatchedQty = Math.max(itemDispatchedQty, tripDispatchedQty)
  const pendingDispatchQty = Math.max(0, totalOrderQty - dispatchedQty)

  const design = designCellStatuses(enquiry)
  const arc = accountsAndProductionCells(enquiry, order, dispatchedQty, totalOrderQty)
  const terminal = terminalCell(enquiry, order, dispatchList, dispatchedQty, totalOrderQty)
  const cells = [...design, ...arc, terminal]

  return {
    enquiryId: enquiry.id,
    enquiryNo: enquiry.enquiryNo,
    projectName: enquiry.projectName,
    clientName: enquiry.customerName,
    priority: enquiry.priority,
    revision: Math.max(1, enquiry.designReview.revision ?? 1),
    orderId: enquiry.orderId,
    orderNo: order?.orderNo,
    dispatchedQty,
    totalOrderQty,
    pendingDispatchQty,
    cells,
    dispatches: dispatchList,
    dispatchSummaryStatus: dispatchSummary(order, dispatchList, dispatchedQty, totalOrderQty),
    activeStageId: pickActiveStage(cells),
  }
}

export interface EnquiryWorkflowBoard {
  rows: EnquiryWorkflowRow[]
  generatedAt: string
}

export function buildEnquiryWorkflowBoard(
  enquiries: Enquiry[],
  orders: Order[],
  dispatches: Dispatch[],
): EnquiryWorkflowBoard {
  const orderById = new Map(orders.map((o) => [o.id, o]))
  const rows = enquiries.map((enquiry) => {
    const order = enquiry.orderId ? orderById.get(enquiry.orderId) : undefined
    return buildEnquiryWorkflowRow(enquiry, order, dispatches)
  })
  rows.sort((a, b) => {
    const p = compareEnquiryPriority(a.priority, b.priority)
    if (p !== 0) return p
    return a.enquiryNo.localeCompare(b.enquiryNo, undefined, { numeric: true })
  })
  return { rows, generatedAt: new Date().toISOString() }
}
