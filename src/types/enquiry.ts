export type EnquiryStage =

  | 'enquiry'

  | 'design_review'

  | 'order'

  | 'manufacturing'

  | 'dispatch'

  | 'completed'



export type DesignReviewStatus =
  | 'pending'
  | 'in_review'
  | 'submitted_to_accounts'
  | 'po_for_review'
  | 'po_for_approval'
  | 'approved'
  | 'revision_needed'



export type ActivityPhase = 'enquiry' | 'design' | 'accounts' | 'order' | 'production' | 'dispatch'



export interface EnquiryDuctLine {
  tagNo: string
  description: string
  width: number
  height: number
  length: number
  quantity: number
  area?: number
  gauge?: number
  dai?: number
  rmt?: number
}

export interface DesignReview {

  status: DesignReviewStatus

  revision: number

  reviewedBy?: string

  reviewDate?: string

  ductTags?: number

  totalQty?: number

  totalArea?: number

  notes?: string

}



export interface EnquiryFilePayload {

  fileName: string

  mimeType?: string

  dataBase64: string

}



export interface EnquiryDesignDocument {

  id: string

  enquiryId: string

  fileName: string

  mimeType?: string | null

  fileSize?: number | null

  inputRevision: number

  isCurrent: boolean

  category?: 'drawing' | 'duct_schedule' | 'design_output' | 'quotation'

  uploadedAt: string

}



export interface ActivityEntry {

  id: string

  timestamp: string

  phase: ActivityPhase

  title: string

  detail?: string

  actor: string

  actorRole?: string

  revision?: number

  metadata?: {

    documentIds?: string[]

    excelFileName?: string

    inputRevision?: number

    assigneeId?: string

    assigneeRoleCode?: string

    productionProcess?: 'straight_ducts' | 'plasma_ducts'

    productionTrackAction?: 'start' | 'pause' | 'resume' | 'complete'

    activeSeconds?: number

  }

  /** @deprecated legacy seed entries */

  date?: string

  /** @deprecated legacy seed entries */

  action?: string

}



export interface CreateEnquiryInput {

  customerId?: string

  projectId?: string

  contactId?: string

  projectContactRole?: string

  customerName: string

  contactPerson?: string

  phone?: string

  email?: string

  projectName: string

  location?: string

  enquiryDate: string

  expectedCompletion?: string

  personInChargeId?: string
  salesPerson?: string

  priority: 'low' | 'normal' | 'high' | 'urgent'

  source?: string

  remarks?: string

  drawingFile?: string

  files?: EnquiryFilePayload[]

}



export interface Enquiry {

  id: string

  enquiryNo: string

  customerId?: string

  projectId?: string

  contactId?: string

  customerName: string

  contactPerson?: string

  phone?: string

  email?: string

  projectName: string

  location?: string

  enquiryDate: string

  expectedCompletion?: string

  personInChargeId?: string

  personInChargeName?: string

  currentAssigneeId?: string

  currentAssigneeName?: string

  currentAssigneeRoleCode?: string | null

  salesPerson?: string

  priority: 'low' | 'normal' | 'high' | 'urgent'

  source?: string

  remarks?: string

  drawingFile?: string

  designDocuments?: EnquiryDesignDocument[]

  ductScheduleDocuments?: EnquiryDesignDocument[]
  designOutputDocuments?: EnquiryDesignDocument[]
  quotationDocuments?: EnquiryDesignDocument[]

  currentDesignDocuments?: EnquiryDesignDocument[]

  ductLines?: EnquiryDuctLine[]

  stage: EnquiryStage

  designReview: DesignReview

  orderId?: string

  activity: ActivityEntry[]

  createdAt: string

}



export type WorkflowDisplayStage =
  | 'enquiry'
  | 'design_review'
  | 'approval_processing'
  | 'manufacturing'
  | 'dispatch'
  | 'completed'

export interface WorkflowStep {
  stage: WorkflowDisplayStage
  label: string
  status: 'completed' | 'current' | 'upcoming'
}


