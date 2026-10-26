import type { Enquiry } from '@/types/enquiry'
import type { Dispatch, Order } from '@/types'
import {
  formatProductionActiveTime,
  getProductionTrackActiveSeconds,
  getProductionTrackStatus,
  PRODUCTION_TRACK_STATUS_LABELS,
} from '@/lib/productionTrack'
import { OPERATIONS_WORKFLOW, resolveWorkflowDisplayStage } from '@/lib/operationsWorkflow'
import { getOperationsFlowConfig, type OperationsFlowConfig } from './config'
import {
  clientKeyForEnquiry,
  compareEnquiryPriority,
  designLaneIndex,
  dispatchTripProgress,
  findPhaseStart,
  orderProgressLabel,
  resolveFlowColumnId,
} from './snapshotUtils'
import type {
  FlowClientNode,
  FlowColumnDef,
  FlowRibbon,
  FlowSnapshot,
  FlowSnapshotFilters,
  FlowWorkCard,
} from './types'

export interface FlowSnapshotInput {
  enquiries: Enquiry[]
  orders: Order[]
  dispatches: Dispatch[]
  config?: OperationsFlowConfig
}

const STAGE_COLUMNS: FlowColumnDef[] = [
  { id: 'enquiry', title: 'Enquiry', subtitle: 'Intake' },
  { id: 'design_review', title: 'Design', subtitle: 'Engineering' },
  { id: 'approval_processing', title: 'Accounts', subtitle: 'PO & approval' },
  { id: 'production', title: 'Production', subtitle: 'Straight / plasma' },
  { id: 'dispatch', title: 'Dispatch', subtitle: 'Loading & trips' },
  { id: 'completed', title: 'Completed', subtitle: 'Delivered' },
]

export function buildFlowColumns(config: OperationsFlowConfig): FlowColumnDef[] {
  return [
    { id: 'clients', title: 'Clients', subtitle: 'Enquiries' },
    ...STAGE_COLUMNS.map((col) => {
      if (col.id === 'design_review') {
        return { ...col, subtitle: `${config.designLaneCount} designer lane(s)` }
      }
      if (col.id === 'production') {
        return {
          ...col,
          subtitle: `${config.straightLaneCount} straight · ${config.plasmaLaneCount} plasma`,
        }
      }
      return col
    }),
  ]
}

function buildDetailLines(
  enquiry: Enquiry,
  order: Order | undefined,
  track: FlowWorkCard['productionTrack'],
): string[] {
  const lines: string[] = []
  if (enquiry.currentAssigneeName) {
    lines.push(`Assignee: ${enquiry.currentAssigneeName}`)
  }
  if (enquiry.designReview.totalArea != null) {
    lines.push(`Schedule area: ${enquiry.designReview.totalArea} m²`)
  }
  if (enquiry.designReview.totalQty != null) {
    lines.push(`Schedule qty: ${enquiry.designReview.totalQty}`)
  }
  if (order) {
    lines.push(`Order: ${order.orderNo}`)
    lines.push(`Order area: ${order.totalArea} m²`)
    if (track === 'straight_ducts') {
      const st = getProductionTrackStatus(order, 'straight_ducts')
      lines.push(`Straight: ${PRODUCTION_TRACK_STATUS_LABELS[st]}`)
      if (st !== 'not_started') {
        lines.push(
          `Straight active time: ${formatProductionActiveTime(getProductionTrackActiveSeconds(order, 'straight_ducts'))}`,
        )
      }
    }
    if (track === 'plasma_ducts') {
      const st = getProductionTrackStatus(order, 'plasma_ducts')
      lines.push(`Plasma: ${PRODUCTION_TRACK_STATUS_LABELS[st]}`)
      if (st !== 'not_started') {
        lines.push(
          `Plasma active time: ${formatProductionActiveTime(getProductionTrackActiveSeconds(order, 'plasma_ducts'))}`,
        )
      }
    }
  }
  lines.push(`Design status: ${enquiry.designReview.status}`)
  return lines
}

function startedAtForCard(
  enquiry: Enquiry,
  columnId: FlowWorkCard['columnId'],
  order: Order | undefined,
): string | undefined {
  if (columnId === 'design_review') return findPhaseStart(enquiry, 'design')
  if (columnId === 'approval_processing') {
    return enquiry.activity.find((a) => /accounts|po|submitted/i.test(a.title))?.timestamp
  }
  if (columnId === 'production' && order) {
    const straight = order.straightDuctsRunStartedAt
    const plasma = order.plasmaDuctsRunStartedAt
    if (straight && plasma) {
      return straight < plasma ? straight : plasma
    }
    return straight ?? plasma ?? order.productionApprovedDate
  }
  if (columnId === 'dispatch') return findPhaseStart(enquiry, 'dispatch')
  if (columnId === 'enquiry') return enquiry.createdAt
  return undefined
}

export function buildOperationsFlowSnapshot(input: FlowSnapshotInput): FlowSnapshot {
  const config = input.config ?? getOperationsFlowConfig()
  const orderById = new Map(input.orders.map((o) => [o.id, o]))
  const clientMap = new Map<string, FlowClientNode>()

  const cards: FlowWorkCard[] = []

  for (const enquiry of input.enquiries) {
    const { id: clientId, name: clientName } = clientKeyForEnquiry(enquiry)
    const clientNode = clientMap.get(clientId) ?? { id: clientId, name: clientName, enquiryIds: [] }
    if (!clientNode.enquiryIds.includes(enquiry.id)) {
      clientNode.enquiryIds.push(enquiry.id)
    }
    clientMap.set(clientId, clientNode)

    const order = enquiry.orderId ? orderById.get(enquiry.orderId) : undefined
    const { columnId, tracks } = resolveFlowColumnId(enquiry, order)
    const displayStage = resolveWorkflowDisplayStage(enquiry)
    const lane = designLaneIndex(enquiry.currentAssigneeId, config.designLaneCount)

    for (const track of tracks) {
      const cardId =
        track === null ? `card-${enquiry.id}` : `card-${enquiry.id}-${track}`
      const progressLabel =
        columnId === 'dispatch' && order
          ? orderProgressLabel(order)
          : columnId === 'dispatch' && enquiry.orderId
            ? dispatchTripProgress(input.dispatches, enquiry.orderId)
            : undefined

      cards.push({
        id: cardId,
        enquiryId: enquiry.id,
        orderId: enquiry.orderId,
        clientId,
        clientName,
        enquiryNo: enquiry.enquiryNo,
        projectName: enquiry.projectName,
        priority: enquiry.priority,
        displayStage,
        columnId,
        productionTrack: track,
        designLaneIndex: lane,
        assigneeName: enquiry.currentAssigneeName ?? enquiry.personInChargeName,
        startedAt: startedAtForCard(enquiry, columnId, order),
        progressLabel,
        totalArea: order?.totalArea ?? enquiry.designReview.totalArea,
        totalQty: order?.totalQuantity ?? enquiry.designReview.totalQty,
        detailLines: buildDetailLines(enquiry, order, track),
      })
    }
  }

  cards.sort((a, b) => {
    const p = compareEnquiryPriority(a.priority, b.priority)
    if (p !== 0) return p
    return a.enquiryNo.localeCompare(b.enquiryNo, undefined, { numeric: true })
  })

  const clients = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  const ribbons: FlowRibbon[] = cards.map((card) => ({
    id: `ribbon-${card.id}`,
    clientId: card.clientId,
    cardId: card.id,
    enquiryId: card.enquiryId,
  }))

  return {
    columns: buildFlowColumns(config),
    clients,
    cards,
    ribbons,
    generatedAt: new Date().toISOString(),
  }
}

export function filterFlowSnapshot(snapshot: FlowSnapshot, filters: FlowSnapshotFilters): FlowSnapshot {
  const cardIds = new Set(
    snapshot.cards
      .filter((c) =>
        matchesCardFilters(c, filters),
      )
      .map((c) => c.id),
  )
  const cards = snapshot.cards.filter((c) => cardIds.has(c.id))
  const enquiryIds = new Set(cards.map((c) => c.enquiryId))
  const clients = snapshot.clients
    .map((cl) => ({
      ...cl,
      enquiryIds: cl.enquiryIds.filter((id) => enquiryIds.has(id)),
    }))
    .filter((cl) => cl.enquiryIds.length > 0)
  const ribbons = snapshot.ribbons.filter((r) => cardIds.has(r.cardId))
  return { ...snapshot, clients, cards, ribbons }
}

function matchesCardFilters(
  card: FlowWorkCard,
  filters: FlowSnapshotFilters,
): boolean {
  if (filters.clientId !== 'all' && card.clientId !== filters.clientId) return false
  if (filters.stage !== 'all' && card.displayStage !== filters.stage) return false
  if (filters.activeOnly && card.displayStage === 'completed') return false
  return true
}

export function stageFilterOptions() {
  return OPERATIONS_WORKFLOW.map((s) => ({ value: s.stage, label: s.dashboardLabel }))
}
