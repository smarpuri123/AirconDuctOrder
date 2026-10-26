import type { WorkflowDisplayStage } from '@/types/enquiry'
import { OPERATIONS_WORKFLOW } from '@/lib/operationsWorkflow'
import { PRODUCTION_PROCESS_LABELS } from '@/types/production'
import type { FlowSnapshot, FlowWorkCard } from './types'

export type SankeyNodeKind = 'client' | 'enquiry' | 'processor'

export interface FlowSankeyNode {
  id: string
  name: string
  kind: SankeyNodeKind
  /** Primary work card for enquiry/processor clicks */
  cardId?: string
  enquiryId?: string
  displayStage?: WorkflowDisplayStage
}

export interface FlowSankeyLink {
  source: string
  target: string
  value: number
  displayStage: WorkflowDisplayStage
}

export interface FlowSankeyGraph {
  nodes: FlowSankeyNode[]
  links: FlowSankeyLink[]
}

export const STAGE_FLOW_COLORS: Record<WorkflowDisplayStage, string> = {
  enquiry: '#009888',
  design_review: '#4f46e5',
  approval_processing: '#d97706',
  manufacturing: '#7c3aed',
  dispatch: '#0284c7',
  completed: '#16a34a',
}

function linkWeight(card: FlowWorkCard): number {
  const area = card.totalArea ?? 0
  if (area > 0) return Math.max(area, 0.5)
  const qty = card.totalQty ?? 0
  if (qty > 0) return Math.max(qty, 0.5)
  return 1
}

function processorLabel(card: FlowWorkCard): string {
  const stageLabel =
    OPERATIONS_WORKFLOW.find((s) => s.stage === card.displayStage)?.dashboardLabel ??
    card.displayStage
  if (card.productionTrack === 'straight_ducts') {
    return `${stageLabel} · ${PRODUCTION_PROCESS_LABELS.straight_ducts}`
  }
  if (card.productionTrack === 'plasma_ducts') {
    return `${stageLabel} · ${PRODUCTION_PROCESS_LABELS.plasma_ducts}`
  }
  const who = card.assigneeName?.trim() || 'Unassigned pool'
  if (card.progressLabel) return `${stageLabel} · ${who} (${card.progressLabel})`
  return `${stageLabel} · ${who}`
}

/** Client → enquiry → processor/stage (3-column Sankey, same idea as plot-flow diagrams). */
export function buildFlowSankeyGraph(snapshot: FlowSnapshot): FlowSankeyGraph {
  const nodeById = new Map<string, FlowSankeyNode>()
  const links: FlowSankeyLink[] = []

  const ensureNode = (node: FlowSankeyNode) => {
    if (!nodeById.has(node.id)) nodeById.set(node.id, node)
  }

  for (const card of snapshot.cards) {
    const weight = linkWeight(card)
    const clientNodeId = `client:${card.clientId}`
    const enquiryNodeId = `enquiry:${card.enquiryId}`
    const processorNodeId = `processor:${card.id}`

    ensureNode({
      id: clientNodeId,
      name: card.clientName,
      kind: 'client',
      enquiryId: card.enquiryId,
    })
    ensureNode({
      id: enquiryNodeId,
      name: `${card.enquiryNo} — ${card.projectName}`,
      kind: 'enquiry',
      enquiryId: card.enquiryId,
      displayStage: card.displayStage,
    })
    ensureNode({
      id: processorNodeId,
      name: processorLabel(card),
      kind: 'processor',
      cardId: card.id,
      enquiryId: card.enquiryId,
      displayStage: card.displayStage,
    })

    links.push({
      source: clientNodeId,
      target: enquiryNodeId,
      value: weight,
      displayStage: card.displayStage,
    })
    links.push({
      source: enquiryNodeId,
      target: processorNodeId,
      value: weight,
      displayStage: card.displayStage,
    })
  }

  return { nodes: Array.from(nodeById.values()), links }
}
