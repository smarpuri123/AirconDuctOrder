import enquiriesSeed from '@/data/enquiries.json'
import { api, isApiMode } from '@/lib/api'
import { createActivityEntry, normalizeActivityEntry, type CreateActivityInput } from '@/lib/activity'
import { getCachedEnquiries, notifyLocalDataChanged, refreshAll } from '@/lib/dataCache'
import { getCurrentUser } from '@/lib/currentUser'
import { loadFromStorage, saveToStorage } from '@/lib/storage'
import { getTodayISO } from '@/lib/calculations'
import { formatCustomerOrderNo } from '@/lib/orderNaming'
import {
  normalizeCustomerCode,
  nextEnquiryNoForClientProject,
} from '@/lib/enquiryNaming'
import { crmService } from './crmService'
import {
  pruneEnquiryFileBlobs,
  storeLocalEnquiryFileBlob,
  uploadEnquiryDocumentsWithProgress,
} from '@/lib/enquiryDocuments'
import {
  enquiryHasClientInput,
  isApprovalProcessing,
  isDesignReviewWork,
  needsEnquiryIntake,
} from '@/lib/enquiryWorkflow'
import { orgService } from './orgService'
import { orderService } from './orderService'
import type {
  ActivityEntry,
  CreateEnquiryInput,
  DesignReview,
  Enquiry,
  EnquiryDesignDocument,
  EnquiryFilePayload,
  EnquiryStage,
  WorkflowStep,
} from '@/types/enquiry'
import { WORKFLOW_STEPS as STEPS } from '@/types/enquiry'
import { filterEnquiriesForDesignerView } from '@/lib/enquiryAssigneeFilter'

async function apiEnquiry<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const result = await api<T>(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  await refreshAll()
  return result
}

function getEnquiriesData(): Enquiry[] {
  if (isApiMode) {
    const cached = getCachedEnquiries()
    return (cached ?? []).map(normalizeEnquiry)
  }
  return loadFromStorage('enquiries', enquiriesSeed as Enquiry[]).map(normalizeEnquiry)
}

function normalizeDesignReview(dr: DesignReview): DesignReview {
  return { ...dr, revision: dr.revision ?? 1 }
}

function normalizeEnquiry(e: Enquiry): Enquiry {
  const designDocuments = e.designDocuments ?? []
  const ductScheduleDocuments = e.ductScheduleDocuments ?? []
  return {
    ...e,
    designDocuments,
    ductScheduleDocuments,
    ductLines: e.ductLines ?? [],
    currentDesignDocuments:
      e.currentDesignDocuments ?? designDocuments.filter((d) => d.isCurrent),
    designReview: normalizeDesignReview(e.designReview),
    activity: (e.activity ?? []).map(normalizeActivityEntry),
  }
}

function persist(enquiries: Enquiry[]): void {
  saveToStorage('enquiries', JSON.stringify(enquiries))
  notifyLocalDataChanged()
}

function formatRevision(revision: number): string {
  return `Rev ${String(revision).padStart(2, '0')}`
}

function addActivity(enquiry: Enquiry, input: CreateActivityInput): ActivityEntry {
  const entry = createActivityEntry(input)
  enquiry.activity = [entry, ...enquiry.activity]
  return entry
}

function addActivityAsCurrentUser(
  enquiry: Enquiry,
  input: Omit<CreateActivityInput, 'actor' | 'actorRole'>,
): ActivityEntry {
  const user = getCurrentUser()
  return addActivity(enquiry, { ...input, actor: user.name, actorRole: user.role })
}

function attachLocalInputFiles(enquiry: Enquiry, files: EnquiryFilePayload[]): void {
  const existing = enquiry.designDocuments ?? []
  const inputRevision = (existing.length ? Math.max(...existing.map((d) => d.inputRevision)) : 0) + 1
  const archived = existing.map((d) => ({ ...d, isCurrent: false }))
  const createdIds: string[] = []
  const names: string[] = []
  const newDocs: EnquiryDesignDocument[] = files.map((file) => {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    storeLocalEnquiryFileBlob(id, file)
    createdIds.push(id)
    names.push(file.fileName)
    const size = Math.floor((file.dataBase64.length * 3) / 4)
    return {
      id,
      enquiryId: enquiry.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: size,
      inputRevision,
      isCurrent: true,
      uploadedAt: new Date().toISOString(),
    }
  })
  enquiry.designDocuments = [...archived, ...newDocs]
  enquiry.currentDesignDocuments = newDocs
  enquiry.drawingFile =
    names.length === 1 ? names[0] : `${names.length} files (Rev ${String(inputRevision).padStart(2, '0')})`
  addActivityAsCurrentUser(enquiry, {
    phase: 'design',
    title: `Client input files — Rev ${String(inputRevision).padStart(2, '0')}`,
    detail: names.join(', '),
    revision: inputRevision,
    metadata: { documentIds: createdIds, inputRevision },
  })
}

const STAGE_ORDER: EnquiryStage[] = ['enquiry', 'design_review', 'order', 'manufacturing', 'dispatch', 'completed']

export const enquiryService = {
  getEnquiries(): Enquiry[] {
    const sorted = getEnquiriesData().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    return filterEnquiriesForDesignerView(sorted)
  },

  getEnquiryById(id: string): Enquiry | undefined {
    return getEnquiriesData().find((e) => e.id === id)
  },

  getEnquiryByOrderId(orderId: string): Enquiry | undefined {
    return getEnquiriesData().find((e) => e.orderId === orderId)
  },

  appendActivity(enquiryId: string, input: CreateActivityInput): ActivityEntry | undefined {
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === enquiryId)
    if (idx === -1) return undefined
    const entry = addActivity(enquiries[idx], input)
    persist(enquiries)
    return entry
  },

  appendActivityByOrderId(orderId: string, input: CreateActivityInput): ActivityEntry | undefined {
    const enquiry = this.getEnquiryByOrderId(orderId)
    if (!enquiry) return undefined
    return this.appendActivity(enquiry.id, input)
  },

  async createEnquiry(input: CreateEnquiryInput): Promise<Enquiry> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>('/enquiries', 'POST', input)
    }
    const enquiries = getEnquiriesData()
    const user = getCurrentUser()
    const pic = input.personInChargeId ? orgService.getEmployeeById(input.personInChargeId) : undefined
    const picName = pic?.name ?? input.salesPerson?.trim() ?? 'Unassigned'
    const client = input.customerId ? await crmService.getClient(input.customerId) : undefined
    const customerCode = normalizeCustomerCode(client?.code, input.customerName)
    const projectFromClient = input.projectId
      ? client?.projects?.find((p) => p.id === input.projectId)
      : undefined
    const projectCode =
      projectFromClient?.code ??
      `PRJ-${input.projectName.replace(/\s+/g, '-').toUpperCase().slice(0, 16)}`
    const id = `enq-${Date.now()}`
    const enquiry: Enquiry = {
      id,
      enquiryNo: nextEnquiryNoForClientProject(
        enquiries,
        customerCode,
        projectCode,
        input.customerId,
        input.projectId,
      ),
      customerId: input.customerId,
      projectId: input.projectId,
      contactId: input.contactId,
      customerName: input.customerName.trim(),
      contactPerson: input.contactPerson?.trim(),
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      projectName: input.projectName.trim(),
      location: input.location?.trim(),
      designDocuments: [],
      currentDesignDocuments: [],
      personInChargeId: input.personInChargeId,
      personInChargeName: picName,
      currentAssigneeId: input.personInChargeId,
      currentAssigneeName: picName,
      currentAssigneeRoleCode: pic?.jobRoles.find((r) => r.isPrimary)?.code ?? null,
      enquiryDate: input.enquiryDate,
      expectedCompletion: input.expectedCompletion,
      salesPerson: picName,
      priority: input.priority,
      source: input.source?.trim(),
      remarks: input.remarks?.trim(),
      drawingFile: input.drawingFile,
      stage: 'enquiry',
      designReview: { status: 'pending', revision: 1 },
      activity: [],
      createdAt: new Date().toISOString(),
    }
    addActivity(enquiry, {
      phase: 'enquiry',
      title: 'Enquiry created',
      detail: `${enquiry.enquiryNo} — ${enquiry.projectName}`,
      actor: user.name,
      actorRole: user.role,
    })
    if (input.files?.length) {
      attachLocalInputFiles(enquiry, input.files)
      enquiry.stage = 'design_review'
    } else if (input.drawingFile) {
      addActivity(enquiry, {
        phase: 'design',
        title: 'Client input noted',
        detail: input.drawingFile,
        actor: user.name,
        actorRole: user.role,
        revision: 1,
      })
    }
    enquiries.unshift(enquiry)
    persist(enquiries)
    return enquiry
  },

  async uploadInputFiles(enquiryId: string, files: EnquiryFilePayload[]): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${enquiryId}/documents`, 'POST', { files })
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === enquiryId)
    if (idx === -1) return undefined
    attachLocalInputFiles(enquiries[idx], files)
    if (enquiries[idx].stage === 'enquiry' && enquiries[idx].designReview.status === 'pending') {
      enquiries[idx].stage = 'design_review'
    }
    persist(enquiries)
    return enquiries[idx]
  },

  async uploadInputFilesWithProgress(
    enquiryId: string,
    files: EnquiryFilePayload[],
    onProgress: (percent: number, phase: 'uploading') => void,
  ): Promise<Enquiry | undefined> {
    if (isApiMode) {
      await uploadEnquiryDocumentsWithProgress(enquiryId, files, (p) => onProgress(p, 'uploading'))
      await refreshAll()
      const cached = getCachedEnquiries()
      return (cached ?? []).map(normalizeEnquiry).find((e) => e.id === enquiryId)
    }
    const steps = 8
    for (let i = 1; i <= steps; i++) {
      await new Promise((r) => setTimeout(r, 40))
      onProgress(Math.round((i / steps) * 100), 'uploading')
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === enquiryId)
    if (idx === -1) return undefined
    attachLocalInputFiles(enquiries[idx], files)
    if (enquiries[idx].stage === 'enquiry' && enquiries[idx].designReview.status === 'pending') {
      enquiries[idx].stage = 'design_review'
    }
    persist(enquiries)
    return enquiries[idx]
  },

  getWorkflowSteps(enquiry: Enquiry): WorkflowStep[] {
    const currentIdx = STAGE_ORDER.indexOf(enquiry.stage)
    return STEPS.map((s) => {
      const stepIdx = STAGE_ORDER.indexOf(s.stage)
      let status: WorkflowStep['status'] = 'upcoming'
      if (stepIdx < currentIdx) status = 'completed'
      else if (stepIdx === currentIdx) status = 'current'
      return { ...s, status }
    })
  },

  filterByStage(stage: EnquiryStage | 'all' | 'approval_processing'): Enquiry[] {
    if (stage === 'all') return this.getEnquiries()
    if (stage === 'approval_processing') {
      return this.getEnquiries().filter((e) => isApprovalProcessing(e))
    }
    if (stage === 'design_review') {
      return this.getEnquiries().filter((e) => isDesignReviewWork(e))
    }
    return this.getEnquiries().filter((e) => e.stage === stage)
  },

  async startDesignReview(
    id: string,
    handoff: { assigneeId: string; assigneeRoleCode?: string },
  ): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/start`, 'POST', handoff)
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined

    const enquiry = enquiries[idx]
    const assignee = orgService.getEmployeeById(handoff.assigneeId)
    if (!assignee) throw new Error('Assignee not found')

    const fromName = enquiry.currentAssigneeName ?? enquiry.personInChargeName ?? enquiry.salesPerson
    enquiry.stage = 'design_review'
    enquiry.designReview = { ...enquiry.designReview, status: 'in_review' }
    enquiry.currentAssigneeId = assignee.id
    enquiry.currentAssigneeName = assignee.name
    enquiry.currentAssigneeRoleCode = handoff.assigneeRoleCode ?? assignee.jobRoles[0]?.code ?? null

    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `Design review started — ${formatRevision(enquiry.designReview.revision)}`,
      detail: `Handoff: ${fromName ?? '—'} → ${assignee.name}${handoff.assigneeRoleCode ? ` (${handoff.assigneeRoleCode})` : ''}`,
      metadata: { assigneeId: assignee.id, assigneeRoleCode: handoff.assigneeRoleCode },
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async saveDuctScheduleImport(
    id: string,
    data: {
      ductTags: number
      totalQty: number
      totalArea: number
      notes?: string
      lines: Enquiry['ductLines']
      excelFile?: EnquiryFilePayload
    },
  ): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/duct-import`, 'POST', data)
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined
    const enquiry = enquiries[idx]
    const lines = data.lines ?? []
    if (!lines.length) return undefined

    enquiry.designReview = {
      ...enquiry.designReview,
      status: 'in_review',
      ductTags: data.ductTags,
      totalQty: data.totalQty,
      totalArea: data.totalArea,
      notes: data.notes,
    }
    enquiry.ductLines = lines

    let ductDocId: string | undefined
    if (data.excelFile) {
      const docId = `doc-duct-${Date.now()}`
      ductDocId = docId
      const doc: EnquiryDesignDocument = {
        id: docId,
        enquiryId: id,
        fileName: data.excelFile.fileName,
        mimeType: data.excelFile.mimeType,
        fileSize: null,
        inputRevision: 0,
        isCurrent: true,
        category: 'duct_schedule',
        uploadedAt: new Date().toISOString(),
      }
      storeLocalEnquiryFileBlob(docId, data.excelFile)
      enquiry.ductScheduleDocuments = [doc, ...(enquiry.ductScheduleDocuments ?? [])]
    }

    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `Duct schedule imported — ${formatRevision(enquiry.designReview.revision)}`,
      detail: `${data.ductTags} tags · ${data.totalQty} qty · ${data.totalArea} m²`,
      revision: enquiry.designReview.revision,
      metadata: ductDocId
        ? { documentIds: [ductDocId], excelFileName: data.excelFile?.fileName }
        : undefined,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async saveDesignExtraction(
    id: string,
    data: Pick<DesignReview, 'ductTags' | 'totalQty' | 'totalArea' | 'notes'>,
  ): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/extraction`, 'PATCH', data)
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined

    const enquiry = enquiries[idx]
    const dr = enquiry.designReview
    const notes = (data.notes ?? '').trim()
    const prevNotes = (dr.notes ?? '').trim()
    if (
      dr.ductTags === data.ductTags &&
      dr.totalQty === data.totalQty &&
      dr.totalArea === data.totalArea &&
      prevNotes === notes
    ) {
      return enquiry
    }

    const revision = enquiry.designReview.revision
    enquiry.designReview = {
      ...enquiry.designReview,
      status: 'in_review',
      ductTags: data.ductTags,
      totalQty: data.totalQty,
      totalArea: data.totalArea,
      notes: data.notes,
    }
    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `Design updated — ${formatRevision(revision)}`,
      detail: `${data.ductTags} tags · ${data.totalQty} qty · ${data.totalArea} m²`,
      revision,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async submitDesignToAccounts(id: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/submit-to-accounts`, 'POST')
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined
    const enquiry = enquiries[idx]
    if (enquiry.designReview.status !== 'in_review') return undefined
    if (!enquiry.designReview.ductTags || !enquiry.designReview.totalQty) return undefined
    const revision = enquiry.designReview.revision
    enquiry.designReview = { ...enquiry.designReview, status: 'submitted_to_accounts' }
    const ductDoc = enquiry.ductScheduleDocuments?.[0]
    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `Submitted to accounts — ${formatRevision(revision)}`,
      detail: 'Duct extraction sent for PO preparation (offline)',
      revision,
      metadata: ductDoc ? { documentIds: [ductDoc.id] } : undefined,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async markPoForReview(id: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/po-for-review`, 'POST')
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined
    const enquiry = enquiries[idx]
    if (enquiry.designReview.status !== 'submitted_to_accounts') return undefined
    const revision = enquiry.designReview.revision
    enquiry.designReview = { ...enquiry.designReview, status: 'po_for_review' }
    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `PO sent for review — ${formatRevision(revision)}`,
      detail: 'Accounts initiated client PO communication',
      revision,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async markPoForApproval(id: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/po-for-approval`, 'POST')
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined
    const enquiry = enquiries[idx]
    if (enquiry.designReview.status !== 'po_for_review') return undefined
    const revision = enquiry.designReview.revision
    enquiry.designReview = { ...enquiry.designReview, status: 'po_for_approval' }
    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `PO pending approval — ${formatRevision(revision)}`,
      detail: 'Awaiting final PO approval',
      revision,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async approveDesign(id: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/approve`, 'POST')
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined

    const enquiry = enquiries[idx]
    if (enquiry.designReview.status !== 'po_for_approval') return undefined
    if (!enquiry.designReview.ductTags || !enquiry.designReview.totalQty) {
      return undefined
    }

    const user = getCurrentUser()
    const today = getTodayISO()
    const revision = enquiry.designReview.revision
    enquiry.designReview = {
      ...enquiry.designReview,
      status: 'approved',
      reviewedBy: user.name,
      reviewDate: today,
    }
    addActivity(enquiry, {
      phase: 'design',
      title: `PO approved — ${formatRevision(revision)}`,
      detail: 'Ready for order conversion',
      actor: user.name,
      actorRole: user.role,
      revision,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async requestDesignRevision(id: string, reason: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/request-revision`, 'POST', { reason })
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined

    const enquiry = enquiries[idx]
    if (enquiry.designReview.status !== 'in_review') return undefined

    const revision = enquiry.designReview.revision
    enquiry.designReview = {
      ...enquiry.designReview,
      status: 'revision_needed',
      reviewedBy: undefined,
      reviewDate: undefined,
    }
    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `Revision requested — ${formatRevision(revision)}`,
      detail: reason.trim() || 'Changes required before approval',
      revision,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async revertDesignWorkflowStep(id: string, reason: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/revert-step`, 'POST', { reason })
    }
    return undefined
  },

  async returnToDesignFromApproval(id: string, reason: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/return-to-design`, 'POST', { reason })
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined
    const enquiry = enquiries[idx]
    const allowed = [
      ...['submitted_to_accounts', 'po_for_review', 'po_for_approval'],
      'approved',
    ]
    if (!allowed.includes(enquiry.designReview.status)) return undefined

    const nextRevision = enquiry.designReview.revision + 1
    enquiry.stage = 'design_review'
    enquiry.designReview = {
      ...enquiry.designReview,
      status: 'in_review',
      revision: nextRevision,
      reviewedBy: undefined,
      reviewDate: undefined,
    }
    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `Returned to design — ${formatRevision(nextRevision)}`,
      detail: reason.trim() || 'Client requested design revision during approval',
      revision: nextRevision,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async resumeDesignRevision(id: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/design/resume-revision`, 'POST')
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined

    const enquiry = enquiries[idx]
    if (enquiry.designReview.status !== 'revision_needed') return undefined

    const nextRevision = enquiry.designReview.revision + 1
    enquiry.stage = 'design_review'
    enquiry.designReview = {
      ...enquiry.designReview,
      status: 'in_review',
      revision: nextRevision,
      reviewedBy: undefined,
      reviewDate: undefined,
    }
    addActivityAsCurrentUser(enquiry, {
      phase: 'design',
      title: `Design revision started — ${formatRevision(nextRevision)}`,
      revision: nextRevision,
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  async convertToOrder(id: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/convert-to-order`, 'POST')
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined
    const enquiry = enquiries[idx]

    if (enquiry.designReview.status !== 'approved') return undefined

    const standardNo = formatCustomerOrderNo(enquiry.projectName, enquiry.enquiryNo)
    const existingOrder = orderService.getOrders().find(
      (o) => o.orderNo === standardNo || o.orderNo === enquiry.projectName,
    )

    const order = existingOrder ?? orderService.createFromEnquiry(enquiry)

    enquiries[idx] = {
      ...enquiry,
      stage: order.status === 'production' ? 'manufacturing' : 'order',
      orderId: order.id,
    }
    addActivityAsCurrentUser(enquiries[idx], {
      phase: 'order',
      title: 'Converted to order',
      detail: order.orderNo,
    })
    persist(enquiries)
    return enquiries[idx]
  },

  getEffectiveStage(enquiry: Enquiry): EnquiryStage {
    if (enquiry.orderId) return this.syncStageFromOrder(enquiry)
    const designStatus = enquiry.designReview.status
    if (designStatus === 'approved') return 'order'
    if (designStatus !== 'pending') return 'design_review'
    if (enquiry.stage === 'enquiry' && enquiryHasClientInput(enquiry)) {
      return 'design_review'
    }
    return enquiry.stage
  },

  withEffectiveStage(enquiry: Enquiry): Enquiry {
    return { ...enquiry, stage: this.getEffectiveStage(enquiry) }
  },

  async acceptEnquiryAndAssignDesign(
    id: string,
    handoff: { assigneeId: string; assigneeRoleCode?: string },
  ): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/intake/complete`, 'POST', handoff)
    }
    await this.completeEnquiryIntake(id)
    return this.startDesignReview(id, handoff)
  },

  async completeEnquiryIntake(id: string): Promise<Enquiry | undefined> {
    if (isApiMode) {
      return apiEnquiry<Enquiry>(`/enquiries/${id}/intake/complete`, 'POST', {})
    }
    const enquiries = getEnquiriesData()
    const idx = enquiries.findIndex((e) => e.id === id)
    if (idx === -1) return undefined
    const enquiry = enquiries[idx]
    if (enquiry.orderId) return enquiry
    if (enquiry.stage !== 'enquiry' || enquiry.designReview.status !== 'pending') return enquiry

    enquiry.stage = 'design_review'
    addActivityAsCurrentUser(enquiry, {
      phase: 'enquiry',
      title: 'Enquiry intake completed',
      detail: 'Marked as attended — ready for design handoff',
    })
    enquiries[idx] = enquiry
    persist(enquiries)
    return enquiry
  },

  syncStageFromOrder(enquiry: Enquiry): EnquiryStage {
    if (!enquiry.orderId) return enquiry.stage
    const order = orderService.getOrderById(enquiry.orderId)
    if (!order) return enquiry.stage

    if (order.status === 'fully_dispatched' || order.status === 'closed') return 'completed'
    if (order.status === 'partially_dispatched' || order.status === 'ready') return 'dispatch'
    if (order.status === 'production') return 'manufacturing'
    return 'order'
  },

  getEnquiryWithLiveStage(id: string): Enquiry | undefined {
    const enquiry = this.getEnquiryById(id)
    if (!enquiry) return undefined
    return this.withEffectiveStage(enquiry)
  },

  getDashboardStats() {
    const enquiries = this.getEnquiries().map((e) => this.withEffectiveStage(e))
    return {
      total: enquiries.length,
      newEnquiries: enquiries.filter((e) => needsEnquiryIntake(e)).length,
      inDesign: enquiries.filter((e) => isDesignReviewWork(e)).length,
      inApprovalProcessing: enquiries.filter((e) => isApprovalProcessing(e)).length,
      inProduction: enquiries.filter((e) => e.stage === 'manufacturing').length,
      readyToDispatch: enquiries.filter((e) => e.stage === 'dispatch').length,
      completed: enquiries.filter((e) => e.stage === 'completed').length,
    }
  },

  resetToSeed(): void {
    if (isApiMode) return
    const enquiries = (enquiriesSeed as Enquiry[]).map(normalizeEnquiry)
    persist(enquiries)
    const keepIds = new Set<string>()
    for (const e of enquiries) {
      for (const d of e.designDocuments ?? []) keepIds.add(d.id)
    }
    pruneEnquiryFileBlobs(keepIds)
  },

  async refresh(): Promise<void> {
    if (isApiMode) await refreshAll()
  },
}
