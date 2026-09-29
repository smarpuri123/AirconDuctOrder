import type {
  CustomerOrder,
  CustomerOrderItem,
  Enquiry,
  EnquiryActivity,
  EnquiryDocument,
} from '@prisma/client'

type EnquiryWithRelations = Enquiry & {
  customer: { id: string; name: string }
  activities: EnquiryActivity[]
  documents?: EnquiryDocument[]
  ductLines?: {
    tagNo: string
    description: string
    width: number
    height: number
    length: number
    quantity: number
    area: unknown
    gauge: number | null
    dai: unknown
    rmt: unknown
  }[]
  personInCharge?: { id: string; name: string } | null
  currentAssignee?: { id: string; name: string } | null
  customerOrder?: {
    id: string
    status: string
    totalQuantity: number
    items: CustomerOrderItem[]
  } | null
}

type OrderWithItems = {
  id: string
  orderNo: string
  customerId: string
  customer: { name: string }
  productionDate: Date | null
  totalQuantity: number
  totalArea: { toString(): string } | number
  status: string
  revision: number
  productionApproved: boolean
  productionApprovedBy: string | null
  productionApprovedDate: Date | null
  straightDuctsCompleted: boolean
  straightDuctsCompletedAt: Date | null
  straightDuctsCompletedBy: string | null
  plasmaDuctsCompleted: boolean
  plasmaDuctsCompletedAt: Date | null
  plasmaDuctsCompletedBy: string | null
  createdAt: Date
  items: CustomerOrderItem[]
}

export function mapDbOrderStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'draft',
    IMPORTED: 'imported',
    CONFIRMED: 'production',
    IN_PRODUCTION: 'production',
    READY: 'ready',
    PARTIALLY_DISPATCHED: 'partially_dispatched',
    FULLY_DISPATCHED: 'fully_dispatched',
    CLOSED: 'closed',
    CANCELLED: 'cancelled',
  }
  return map[status] ?? status.toLowerCase()
}

export function mapFrontendOrderStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'DRAFT',
    imported: 'IMPORTED',
    production: 'IN_PRODUCTION',
    ready: 'READY',
    partially_dispatched: 'PARTIALLY_DISPATCHED',
    fully_dispatched: 'FULLY_DISPATCHED',
    closed: 'CLOSED',
    cancelled: 'CANCELLED',
  }
  return map[status] ?? status.toUpperCase()
}

function computeFrontendOrderStatus(order: OrderWithItems): string {
  const dispatched = order.items.reduce((s, i) => s + i.dispatchedQty, 0)
  if (dispatched >= order.totalQuantity && order.totalQuantity > 0) return 'fully_dispatched'
  if (dispatched > 0) return 'partially_dispatched'
  const base = mapDbOrderStatus(order.status)
  if (base === 'production' || base === 'confirmed') return 'production'
  return base === 'ready' ? 'ready' : base
}

export function mapOrderToFrontend(order: OrderWithItems) {
  const dispatchedQty = order.items.reduce((s, i) => s + i.dispatchedQty, 0)
  const balanceQty = order.totalQuantity - dispatchedQty

  return {
    id: order.id,
    orderNo: order.orderNo,
    jobName: order.orderNo,
    customerId: order.customerId,
    customerName: order.customer.name,
    productionDate: order.productionDate?.toISOString().split('T')[0] ?? '',
    totalQuantity: order.totalQuantity,
    totalArea: Number(order.totalArea),
    status: computeFrontendOrderStatus(order),
    revision: order.revision,
    productionApproved: order.productionApproved,
    productionApprovedBy: order.productionApprovedBy ?? undefined,
    productionApprovedDate: order.productionApprovedDate?.toISOString().split('T')[0],
    straightDuctsCompleted: order.straightDuctsCompleted,
    straightDuctsCompletedAt: order.straightDuctsCompletedAt?.toISOString(),
    straightDuctsCompletedBy: order.straightDuctsCompletedBy ?? undefined,
    plasmaDuctsCompleted: order.plasmaDuctsCompleted,
    plasmaDuctsCompletedAt: order.plasmaDuctsCompletedAt?.toISOString(),
    plasmaDuctsCompletedBy: order.plasmaDuctsCompletedBy ?? undefined,
    createdAt: order.createdAt.toISOString(),
    dispatchedQty,
    balanceQty,
    items: order.items
      .map((item) => ({
        id: item.id,
        orderId: order.id,
        tagNo: parseInt(item.tagNo, 10) || 0,
        description: item.description,
        w1: item.w1,
        h1: item.h1,
        w2: item.w2,
        h2: item.h2,
        length: item.length,
        orderedQty: item.orderedQty,
        area: Number(item.area),
        producedQty: item.producedQty,
        readyQty: item.readyQty,
        dispatchedQty: item.dispatchedQty,
      }))
      .sort((a, b) => a.tagNo - b.tagNo),
  }
}

function mapDesignStatus(designStatus: string): string {
  const map: Record<string, string> = {
    PENDING: 'pending',
    IN_REVIEW: 'in_review',
    SUBMITTED_TO_ACCOUNTS: 'submitted_to_accounts',
    PO_FOR_REVIEW: 'po_for_review',
    PO_FOR_APPROVAL: 'po_for_approval',
    APPROVED: 'approved',
    REVISION_NEEDED: 'revision_needed',
  }
  return map[designStatus] ?? designStatus.toLowerCase()
}

function mapPriority(priority: string): string {
  return priority.toLowerCase()
}

function enquiryHasClientInput(enquiry: EnquiryWithRelations): boolean {
  const docs = enquiry.documents ?? []
  if (docs.some((d) => (d as { category?: string }).category !== 'duct_schedule')) return true
  if (enquiry.drawingFileName?.trim()) return true
  return enquiry.activities.some(
    (a) => a.phase === 'design' && /client input|input files/i.test(a.title),
  )
}

function computeEnquiryStage(enquiry: EnquiryWithRelations): string {
  if (!enquiry.customerOrderId || !enquiry.customerOrder) {
    if (
      enquiry.designStatus === 'PENDING' &&
      (enquiry.status === 'NEW' || enquiry.status === 'INTAKE_COMPLETE')
    ) {
      if (enquiry.status === 'INTAKE_COMPLETE' || enquiryHasClientInput(enquiry)) {
        return 'design_review'
      }
      return 'enquiry'
    }
    if (
      [
        'IN_REVIEW',
        'REVISION_NEEDED',
        'PENDING',
        'SUBMITTED_TO_ACCOUNTS',
        'PO_FOR_REVIEW',
        'PO_FOR_APPROVAL',
      ].includes(enquiry.designStatus)
    ) {
      return 'design_review'
    }
    if (enquiry.designStatus === 'APPROVED') return 'order'
    return 'enquiry'
  }

  const order = enquiry.customerOrder
  const dispatched = order.items.reduce((s, i) => s + i.dispatchedQty, 0)
  const status = mapDbOrderStatus(order.status)

  if (status === 'fully_dispatched' || status === 'closed') return 'completed'
  if (status === 'partially_dispatched' || status === 'ready') return 'dispatch'
  if (status === 'production' || status === 'in_production') return 'manufacturing'
  return 'order'
}

export function mapEnquiryToFrontend(enquiry: EnquiryWithRelations) {
  return {
    id: enquiry.id,
    enquiryNo: enquiry.enquiryNo,
    customerId: enquiry.customerId,
    projectId: enquiry.projectId,
    contactId: enquiry.contactId,
    customerName: enquiry.customer.name,
    contactPerson: enquiry.contactPerson,
    phone: enquiry.phone,
    email: enquiry.email,
    projectName: enquiry.projectName,
    location: enquiry.projectLocation,
    enquiryDate: enquiry.enquiryDate.toISOString().split('T')[0],
    expectedCompletion: enquiry.expectedCompletion?.toISOString().split('T')[0],
    salesPerson: enquiry.salesPerson,
    personInChargeId: enquiry.personInChargeId,
    personInChargeName: enquiry.personInCharge?.name ?? enquiry.salesPerson,
    currentAssigneeId: enquiry.currentAssigneeId,
    currentAssigneeName: enquiry.currentAssignee?.name,
    currentAssigneeRoleCode: enquiry.currentAssigneeRoleCode,
    priority: mapPriority(enquiry.priority) as 'low' | 'normal' | 'high' | 'urgent',
    source: enquiry.source,
    remarks: enquiry.remarks,
    drawingFile: enquiry.drawingFileName,
    designDocuments: (enquiry.documents ?? [])
      .filter((d) => (d as { category?: string }).category !== 'duct_schedule')
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .map((d) => ({
        id: d.id,
        enquiryId: d.enquiryId,
        fileName: d.fileName,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        inputRevision: d.inputRevision,
        isCurrent: d.isCurrent,
        category: (d as { category?: string }).category ?? 'drawing',
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    ductScheduleDocuments: (enquiry.documents ?? [])
      .filter((d) => (d as { category?: string }).category === 'duct_schedule')
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .map((d) => ({
        id: d.id,
        enquiryId: d.enquiryId,
        fileName: d.fileName,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        inputRevision: d.inputRevision,
        isCurrent: d.isCurrent,
        category: 'duct_schedule' as const,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    currentDesignDocuments: (enquiry.documents ?? [])
      .filter((d) => d.isCurrent && (d as { category?: string }).category !== 'duct_schedule')
      .map((d) => ({
        id: d.id,
        enquiryId: d.enquiryId,
        fileName: d.fileName,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        inputRevision: d.inputRevision,
        isCurrent: d.isCurrent,
        category: (d as { category?: string }).category ?? 'drawing',
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    ductLines: (enquiry.ductLines ?? []).map((line) => ({
      tagNo: line.tagNo,
      description: line.description,
      width: line.width,
      height: line.height,
      length: line.length,
      quantity: line.quantity,
      area: line.area != null ? Number(line.area) : undefined,
      gauge: line.gauge ?? undefined,
      dai: line.dai != null ? Number(line.dai) : undefined,
      rmt: line.rmt != null ? Number(line.rmt) : undefined,
    })),
    stage: computeEnquiryStage(enquiry),
    designReview: {
      status: mapDesignStatus(enquiry.designStatus),
      revision: enquiry.designRevision,
      reviewedBy: enquiry.designReviewedBy,
      reviewDate: enquiry.designReviewDate?.toISOString().split('T')[0],
      ductTags: enquiry.ductTags,
      totalQty: enquiry.ductTotalQty,
      totalArea: enquiry.ductTotalArea ? Number(enquiry.ductTotalArea) : undefined,
      notes: enquiry.designNotes,
    },
    orderId: enquiry.customerOrderId,
    activity: enquiry.activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .map((a) => ({
        id: a.id,
        timestamp: a.timestamp.toISOString(),
        phase: a.phase,
        title: a.title,
        detail: a.detail,
        actor: a.actor,
        actorRole: a.actorRole,
        revision: a.revision,
        metadata: a.metadata as Record<string, unknown> | undefined,
      })),
    createdAt: enquiry.createdAt.toISOString(),
  }
}
