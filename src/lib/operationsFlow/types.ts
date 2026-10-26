import type { WorkflowDisplayStage } from '@/types/enquiry'
import type { Enquiry } from '@/types/enquiry'

export type FlowColumnId =
  | 'clients'
  | 'enquiry'
  | 'design_review'
  | 'approval_processing'
  | 'production'
  | 'dispatch'
  | 'completed'

export type FlowProductionTrack = 'straight_ducts' | 'plasma_ducts' | null

export interface FlowColumnDef {
  id: FlowColumnId
  title: string
  subtitle?: string
}

export interface FlowClientNode {
  id: string
  name: string
  enquiryIds: string[]
}

export interface FlowWorkCard {
  id: string
  enquiryId: string
  orderId?: string
  clientId: string
  clientName: string
  enquiryNo: string
  projectName: string
  priority: Enquiry['priority']
  displayStage: WorkflowDisplayStage
  columnId: FlowColumnId
  productionTrack: FlowProductionTrack
  designLaneIndex: number
  assigneeName?: string
  startedAt?: string
  progressLabel?: string
  totalArea?: number
  totalQty?: number
  detailLines: string[]
}

export interface FlowRibbon {
  id: string
  clientId: string
  cardId: string
  enquiryId: string
}

export interface FlowSnapshot {
  columns: FlowColumnDef[]
  clients: FlowClientNode[]
  cards: FlowWorkCard[]
  ribbons: FlowRibbon[]
  generatedAt: string
}

export interface FlowSnapshotFilters {
  clientId: string | 'all'
  stage: WorkflowDisplayStage | 'all'
  activeOnly: boolean
}
