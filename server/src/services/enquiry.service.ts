import { prisma } from '../lib/prisma.js'
import { mapEnquiryToFrontend } from '../lib/mappers.js'
import { contactFullName } from '../lib/contact.js'
import { saveEnquiryFile, type IncomingEnquiryFile } from '../lib/enquiry-files.js'
import { formatCustomerOrderNo } from '../lib/order-naming.js'
import {
  allocateNextEnquiryNo,
  normalizeCustomerCode,
} from '../lib/enquiry-naming.js'
import type { ActivityActor } from '../lib/operation-actor.js'
import { runTransactionWithRetry } from '../lib/transaction-retry.js'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  APPROVAL_PROCESSING_STATUSES,
  canEditDesignExtraction,
  canRequestDesignRevision,
  canRevertDesignStep,
  designStatusLabel,
  previousDesignStatus,
} from '../lib/design-workflow.js'
import { isOrderFullyDelivered, orderHasDispatches } from '../lib/order-workflow.js'
import type { DesignerEnquiryListScope } from '../lib/enquiry-access.js'
import { listScopeToPrismaWhere } from '../lib/enquiry-access.js'

const enquiryInclude = {
  customer: true,
  activities: { orderBy: { timestamp: 'desc' as const } },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
  ductLines: { orderBy: { sortOrder: 'asc' as const } },
  personInCharge: true,
  currentAssignee: true,
  customerOrder: { include: { items: true } },
}

function formatRevision(revision: number): string {
  return `Rev ${String(revision).padStart(2, '0')}`
}

type DuctLineInput = {
  tagNo: string
  description?: string
  width: number
  height: number
  length: number
  quantity: number
  area?: number
  gauge?: number
  dai?: number
  rmt?: number
}

function orderItemsFromDuctLines(lines: DuctLineInput[]) {
  return lines.map((line) => ({
    tagNo: line.tagNo,
    description: (line.description ?? 'OFLINE').trim() || 'OFLINE',
    w1: line.width,
    h1: line.height,
    w2: line.width,
    h2: line.height,
    length: line.length,
    orderedQty: line.quantity,
    area: line.area ?? 0,
    producedQty: 0,
    readyQty: 0,
    dispatchedQty: 0,
  }))
}

function totalsFromDuctLines(lines: DuctLineInput[]) {
  let totalQty = 0
  let totalArea = 0
  for (const line of lines) {
    totalQty += line.quantity
    totalArea += line.area ?? 0
  }
  return { totalQty, totalArea: Math.round(totalArea * 100) / 100 }
}

async function loadDuctLinesForEnquiry(enquiryId: string): Promise<DuctLineInput[]> {
  const rows = await prisma.enquiryDuctLine.findMany({
    where: { enquiryId },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map((r) => ({
    tagNo: r.tagNo,
    description: r.description,
    width: r.width,
    height: r.height,
    length: r.length,
    quantity: r.quantity,
    area: r.area != null ? Number(r.area) : undefined,
    gauge: r.gauge ?? undefined,
    dai: r.dai != null ? Number(r.dai) : undefined,
    rmt: r.rmt != null ? Number(r.rmt) : undefined,
  }))
}

async function syncLinkedCustomerOrderFromDuctLines(
  enquiry: { id: string; customerOrderId: string | null; projectName: string; enquiryNo: string },
) {
  if (!enquiry.customerOrderId) return
  const lines = await loadDuctLinesForEnquiry(enquiry.id)
  if (!lines.length) return

  const items = orderItemsFromDuctLines(lines)
  const { totalQty, totalArea } = totalsFromDuctLines(lines)
  const standardOrderNo = formatCustomerOrderNo(enquiry.projectName, enquiry.enquiryNo)

  await prisma.$transaction(async (tx) => {
    await tx.customerOrderItem.deleteMany({ where: { customerOrderId: enquiry.customerOrderId! } })
    await tx.customerOrderItem.createMany({
      data: items.map((item) => ({
        ...item,
        customerOrderId: enquiry.customerOrderId!,
      })),
    })
    const orderUpdate: { totalQuantity: number; totalArea: number; orderNo?: string } = {
      totalQuantity: totalQty,
      totalArea,
    }
    const order = await tx.customerOrder.findUnique({ where: { id: enquiry.customerOrderId! } })
    if (order && order.orderNo !== standardOrderNo) {
      const conflict = await tx.customerOrder.findUnique({ where: { orderNo: standardOrderNo } })
      if (!conflict) orderUpdate.orderNo = standardOrderNo
    }
    await tx.customerOrder.update({
      where: { id: enquiry.customerOrderId! },
      data: orderUpdate,
    })
  })
}

async function enquiryWorkflowGuards(enquiryId: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { customerOrder: { include: { items: true } } },
  })
  if (!enquiry) return null
  const order = enquiry.customerOrder
  const orderDelivered = order ? isOrderFullyDelivered(order.status) : false
  const hasDispatches = order ? orderHasDispatches(order.items) : false
  return { enquiry, orderDelivered, hasDispatches }
}

async function transitionEnquiryDesignStatus(
  id: string,
  fromStatuses: string[],
  data: Prisma.EnquiryUpdateManyMutationInput,
): Promise<boolean> {
  const result = await prisma.enquiry.updateMany({
    where: { id, designStatus: { in: fromStatuses } },
    data,
  })
  return result.count === 1
}

async function logActivity(
  enquiryId: string,
  input: {
    phase: string
    title: string
    detail?: string
    actor: string
    actorRole?: string
    revision?: number
    metadata?: Prisma.InputJsonValue
  },
) {
  return prisma.enquiryActivity.create({ data: { enquiryId, ...input } })
}

type DesignExtractionPayload = {
  ductTags: number
  totalQty: number
  totalArea: number
  notes?: string
}

function designExtractionDetail(data: DesignExtractionPayload): string {
  return `${data.ductTags} tags · ${data.totalQty} qty · ${data.totalArea} m²`
}

function normalizeDesignNotes(notes?: string | null): string {
  return (notes ?? '').trim()
}

function designExtractionUnchanged(
  enquiry: {
    ductTags: number | null
    ductTotalQty: number | null
    ductTotalArea: unknown
    designNotes: string | null
  },
  data: DesignExtractionPayload,
): boolean {
  const area = enquiry.ductTotalArea != null ? Number(enquiry.ductTotalArea) : null
  return (
    enquiry.ductTags === data.ductTags &&
    enquiry.ductTotalQty === data.totalQty &&
    area === data.totalArea &&
    normalizeDesignNotes(enquiry.designNotes) === normalizeDesignNotes(data.notes)
  )
}

const DESIGN_UPDATE_DEDUPE_MS = 5000

async function isDuplicateDesignUpdateLog(
  enquiryId: string,
  title: string,
  detail: string,
  revision: number,
): Promise<boolean> {
  const last = await prisma.enquiryActivity.findFirst({
    where: { enquiryId, phase: 'design' },
    orderBy: { timestamp: 'desc' },
  })
  if (!last) return false
  if (last.title !== title || last.detail !== detail || last.revision !== revision) return false
  return Date.now() - last.timestamp.getTime() < DESIGN_UPDATE_DEDUPE_MS
}

async function findOrCreateCustomer(name: string) {
  const code = name.replace(/\s+/g, '-').toUpperCase().slice(0, 20)
  return prisma.customer.upsert({
    where: { code },
    update: { name },
    create: { code, name, active: true },
  })
}

export async function listEnquiries(scope: DesignerEnquiryListScope = { mode: 'all' }) {
  const enquiries = await prisma.enquiry.findMany({
    where: listScopeToPrismaWhere(scope),
    include: enquiryInclude,
    orderBy: { createdAt: 'desc' },
  })
  return enquiries.map(mapEnquiryToFrontend)
}

export async function getEnquiryById(id: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: enquiryInclude,
  })
  return enquiry ? mapEnquiryToFrontend(enquiry) : null
}

export async function getEnquiryDocument(enquiryId: string, documentId: string) {
  return prisma.enquiryDocument.findFirst({ where: { id: documentId, enquiryId } })
}

export async function getEnquiryByOrderId(orderId: string) {
  const enquiry = await prisma.enquiry.findFirst({
    where: { customerOrderId: orderId },
    include: enquiryInclude,
  })
  return enquiry ? mapEnquiryToFrontend(enquiry) : null
}

export type CreateEnquiryPayload = {
  customerId?: string
  projectId?: string
  contactId?: string
  projectContactRole?: string
  customerName?: string
  contactPerson?: string
  phone?: string
  email?: string
  projectName?: string
  location?: string
  enquiryDate: string
  expectedCompletion?: string
  salesPerson?: string
  personInChargeId?: string
  priority: string
  source?: string
  remarks?: string
  drawingFile?: string
  files?: IncomingEnquiryFile[]
}

async function resolveEnquiryMasters(input: CreateEnquiryPayload) {
  let customerId = input.customerId
  if (!customerId && input.customerName?.trim()) {
    const customer = await findOrCreateCustomer(input.customerName.trim())
    customerId = customer.id
  }
  if (!customerId) throw new Error('Client is required')

  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) throw new Error('Client not found')

  let projectId = input.projectId
  let projectName = input.projectName?.trim() ?? ''
  let projectLocation = input.location?.trim() ?? ''
  let projectCode: string | undefined

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, customerId } })
    if (!project) throw new Error('Project not found for this client')
    projectName = project.name
    projectLocation = project.location ?? projectLocation
    projectCode = project.code
  } else if (projectName) {
    const code = `PRJ-${projectName.replace(/\s+/g, '-').toUpperCase().slice(0, 12)}-${randomUUID().slice(0, 8)}`
    const project = await prisma.project.create({
      data: {
        customerId,
        code,
        name: projectName,
        location: projectLocation || undefined,
        status: 'ACTIVE',
      },
    })
    projectId = project.id
    projectCode = project.code
  }

  if (!projectName) throw new Error('Project is required')
  if (!projectId || !projectCode) throw new Error('Project is required')

  let contactId = input.contactId
  let contactPerson = input.contactPerson?.trim() ?? ''
  let phone = input.phone?.trim() ?? ''
  let email = input.email?.trim()

  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, customerId } })
    if (!contact) throw new Error('Contact not found for this client')
    contactPerson = contactFullName(contact.firstName, contact.lastName)
    phone = contact.phone ?? phone
    email = contact.email ?? email

    if (projectId && input.projectContactRole) {
      await prisma.projectContact.upsert({
        where: {
          projectId_contactId_role: {
            projectId,
            contactId,
            role: input.projectContactRole,
          },
        },
        update: { isActive: true },
        create: {
          projectId,
          contactId,
          role: input.projectContactRole,
          isPrimary: false,
          isActive: true,
        },
      })
    }
  }

  return {
    customerId,
    customerName: customer.name,
    customerCode: normalizeCustomerCode(customer.code, customer.name),
    projectId,
    projectCode,
    contactId,
    projectName,
    projectLocation,
    contactPerson,
    phone,
    email,
  }
}

async function nextInputRevision(enquiryId: string): Promise<number> {
  const latest = await prisma.enquiryDocument.findFirst({
    where: { enquiryId },
    orderBy: { inputRevision: 'desc' },
  })
  return (latest?.inputRevision ?? 0) + 1
}

export async function attachEnquiryInputFiles(
  enquiryId: string,
  files: IncomingEnquiryFile[],
  actor: ActivityActor,
  inputRevision?: number,
) {
  if (!files.length) return getEnquiryById(enquiryId)

  const revision = inputRevision ?? (await nextInputRevision(enquiryId))
  await prisma.enquiryDocument.updateMany({
    where: { enquiryId, isCurrent: true },
    data: { isCurrent: false },
  })

  const createdIds: string[] = []
  const names: string[] = []
  for (const file of files) {
    const { filePath, fileSize } = await saveEnquiryFile(enquiryId, file)
    const doc = await prisma.enquiryDocument.create({
      data: {
        enquiryId,
        fileName: file.fileName,
        filePath,
        mimeType: file.mimeType,
        fileSize,
        inputRevision: revision,
        isCurrent: true,
      },
    })
    createdIds.push(doc.id)
    names.push(file.fileName)
  }

  const primaryName = names[0]
  const existing = await prisma.enquiry.findUnique({ where: { id: enquiryId }, select: { status: true } })
  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: {
      drawingFileName: names.length === 1 ? primaryName : `${names.length} files (Rev ${revision})`,
      ...(existing?.status === 'NEW' ? { status: 'INTAKE_COMPLETE' } : {}),
    },
  })

  await logActivity(enquiryId, {
    phase: 'design',
    title: `Client input files — Rev ${String(revision).padStart(2, '0')}`,
    detail: names.join(', '),
    actor: actor.name,
    actorRole: actor.role,
    revision,
    metadata: { documentIds: createdIds, inputRevision: revision },
  })

  return getEnquiryById(enquiryId)
}

export async function completeEnquiryIntake(id: string, actor: ActivityActor) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry) return null
  if (enquiry.customerOrderId) return null
  if (enquiry.status !== 'NEW' || enquiry.designStatus !== 'PENDING') {
    return getEnquiryById(id)
  }

  const moved = await prisma.enquiry.updateMany({
    where: { id, status: 'NEW', designStatus: 'PENDING', customerOrderId: null },
    data: { status: 'INTAKE_COMPLETE' },
  })
  if (moved.count !== 1) return getEnquiryById(id)

  await logActivity(id, {
    phase: 'enquiry',
    title: 'Enquiry intake completed',
    detail: 'Marked as attended — ready for design handoff',
    actor: actor.name,
    actorRole: actor.role,
  })

  return getEnquiryById(id)
}

async function resolvePersonInCharge(input: { personInChargeId?: string; salesPerson?: string }) {
  if (input.personInChargeId) {
    const emp = await prisma.employee.findUnique({ where: { id: input.personInChargeId } })
    if (!emp) throw new Error('Person in charge not found')
    return {
      personInChargeId: emp.id,
      currentAssigneeId: emp.id,
      salesPerson: emp.name,
      assigneeRoleCode: null as string | null,
    }
  }
  const name = input.salesPerson?.trim() || 'Unassigned'
  return {
    personInChargeId: null as string | null,
    currentAssigneeId: null as string | null,
    salesPerson: name,
    assigneeRoleCode: null as string | null,
  }
}

export async function createEnquiry(input: CreateEnquiryPayload, actor: ActivityActor) {
  const resolved = await resolveEnquiryMasters(input)
  const pic = await resolvePersonInCharge(input)

  const enquiry = await runTransactionWithRetry(async (tx) => {
    const enquiryNo = await allocateNextEnquiryNo(tx, {
      customerId: resolved.customerId,
      projectId: resolved.projectId!,
      customerCode: resolved.customerCode,
      projectCode: resolved.projectCode!,
    })

    return tx.enquiry.create({
    data: {
      enquiryNo,
      customerId: resolved.customerId,
      projectId: resolved.projectId,
      contactId: resolved.contactId,
      contactPerson: resolved.contactPerson,
      phone: resolved.phone,
      email: resolved.email,
      projectName: resolved.projectName,
      projectLocation: resolved.projectLocation,
      enquiryDate: new Date(input.enquiryDate),
      expectedCompletion: input.expectedCompletion ? new Date(input.expectedCompletion) : null,
      salesPerson: pic.salesPerson,
      personInChargeId: pic.personInChargeId,
      currentAssigneeId: pic.currentAssigneeId,
      currentAssigneeRoleCode: pic.assigneeRoleCode,
      priority: input.priority.toUpperCase(),
      source: input.source?.trim(),
      remarks: input.remarks?.trim(),
      drawingFileName: input.drawingFile,
      status: 'NEW',
      designStatus: 'PENDING',
      designRevision: 1,
    },
    include: enquiryInclude,
    })
  })

  const enquiryNo = enquiry.enquiryNo

  await logActivity(enquiry.id, {
    phase: 'enquiry',
    title: 'Enquiry created',
    detail: `${enquiryNo} — ${resolved.projectName}`,
    actor: actor.name,
    actorRole: actor.role,
  })

  if (input.files?.length) {
    await attachEnquiryInputFiles(enquiry.id, input.files, actor, 1)
  } else if (input.drawingFile) {
    await logActivity(enquiry.id, {
      phase: 'design',
      title: 'Client input noted',
      detail: input.drawingFile,
      actor: actor.name,
      actorRole: actor.role,
      revision: 1,
    })
  }

  return getEnquiryById(enquiry.id)
}

export async function startDesignReview(
  id: string,
  actor: ActivityActor,
  handoff?: { assigneeId: string; assigneeRoleCode?: string },
) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry) return null

  let assigneeName: string | undefined
  if (handoff?.assigneeId) {
    const assignee = await prisma.employee.findUnique({ where: { id: handoff.assigneeId } })
    if (!assignee) throw new Error('Assignee not found')
    assigneeName = assignee.name
    await prisma.enquiry.update({
      where: { id },
      data: {
        status: 'DESIGN_REVIEW',
        designStatus: 'IN_REVIEW',
        currentAssigneeId: assignee.id,
        currentAssigneeRoleCode: handoff.assigneeRoleCode ?? null,
      },
    })
  } else {
    await prisma.enquiry.update({
      where: { id },
      data: { status: 'DESIGN_REVIEW', designStatus: 'IN_REVIEW' },
    })
  }

  const pic =
    enquiry.personInChargeId
      ? await prisma.employee.findUnique({ where: { id: enquiry.personInChargeId } })
      : null
  const fromName = pic?.name ?? enquiry.salesPerson ?? '—'

  await logActivity(id, {
    phase: 'design',
    title: `Design review started — ${formatRevision(enquiry.designRevision)}`,
    detail: assigneeName
      ? `Handoff: ${fromName ?? '—'} → ${assigneeName}${handoff?.assigneeRoleCode ? ` (${handoff.assigneeRoleCode})` : ''}`
      : undefined,
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
    metadata: handoff?.assigneeId
      ? { assigneeId: handoff.assigneeId, assigneeRoleCode: handoff.assigneeRoleCode }
      : undefined,
  })

  return getEnquiryById(id)
}

/** Mark intake attended (if needed) and assign design in-charge in one step. */
export async function acceptEnquiryAndAssignDesign(
  id: string,
  actor: ActivityActor,
  handoff: { assigneeId: string; assigneeRoleCode?: string },
) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry) return null
  if (enquiry.customerOrderId) return null
  if (enquiry.designStatus !== 'PENDING') {
    return startDesignReview(id, actor, handoff)
  }

  if (enquiry.status === 'NEW') {
    const moved = await prisma.enquiry.updateMany({
      where: { id, status: 'NEW', designStatus: 'PENDING', customerOrderId: null },
      data: { status: 'INTAKE_COMPLETE' },
    })
    if (moved.count === 1) {
      await logActivity(id, {
        phase: 'enquiry',
        title: 'Enquiry accepted',
        detail: 'Intake complete — assigned to design in-charge',
        actor: actor.name,
        actorRole: actor.role,
      })
    }
  }

  return startDesignReview(id, actor, handoff)
}

export async function saveDesignExtraction(
  id: string,
  data: DesignExtractionPayload,
  actor: ActivityActor,
) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry) return null
  const guards = await enquiryWorkflowGuards(id)
  if (!guards) return null
  if (
    !canEditDesignExtraction(enquiry.designStatus, {
      hasCustomerOrder: Boolean(enquiry.customerOrderId),
      orderDelivered: guards.orderDelivered,
    })
  ) {
    return null
  }

  if (designExtractionUnchanged(enquiry, data)) {
    return getEnquiryById(id)
  }

  const title = `Design updated — ${formatRevision(enquiry.designRevision)}`
  const detail = designExtractionDetail(data)

  if (await isDuplicateDesignUpdateLog(id, title, detail, enquiry.designRevision)) {
    return getEnquiryById(id)
  }

  const keepStatus = APPROVAL_PROCESSING_STATUSES.includes(
    enquiry.designStatus as (typeof APPROVAL_PROCESSING_STATUSES)[number],
  ) || enquiry.designStatus === 'APPROVED'

  await prisma.enquiry.update({
    where: { id },
    data: {
      ...(keepStatus ? {} : { designStatus: 'IN_REVIEW' }),
      ductTags: data.ductTags,
      ductTotalQty: data.totalQty,
      ductTotalArea: data.totalArea,
      designNotes: normalizeDesignNotes(data.notes) || null,
    },
  })

  await logActivity(id, {
    phase: 'design',
    title,
    detail,
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
  })

  return getEnquiryById(id)
}

export type DuctScheduleImportPayload = DesignExtractionPayload & {
  lines: DuctLineInput[]
  excelFile?: IncomingEnquiryFile
}

export async function saveDuctScheduleImport(
  id: string,
  data: DuctScheduleImportPayload,
  actor: ActivityActor,
) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry) return null
  const guards = await enquiryWorkflowGuards(id)
  if (!guards) return null
  if (
    !canEditDesignExtraction(enquiry.designStatus, {
      hasCustomerOrder: Boolean(enquiry.customerOrderId),
      orderDelivered: guards.orderDelivered,
    })
  ) {
    return null
  }
  if (!data.lines.length) return null

  let ductScheduleDocumentId: string | undefined
  let savedExcel:
    | { filePath: string; fileSize: number; fileName: string; mimeType?: string }
    | undefined
  if (data.excelFile) {
    const { filePath, fileSize } = await saveEnquiryFile(id, data.excelFile)
    savedExcel = {
      filePath,
      fileSize,
      fileName: data.excelFile.fileName,
      mimeType: data.excelFile.mimeType,
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.enquiryDuctLine.deleteMany({ where: { enquiryId: id } })
    await tx.enquiryDuctLine.createMany({
      data: data.lines.map((line, sortOrder) => ({
        enquiryId: id,
        sortOrder,
        tagNo: line.tagNo.trim(),
        description: (line.description ?? 'OFLINE').trim() || 'OFLINE',
        width: line.width,
        height: line.height,
        length: line.length,
        quantity: line.quantity,
        area: line.area ?? null,
        gauge: line.gauge ?? null,
        dai: line.dai ?? null,
        rmt: line.rmt ?? null,
      })),
    })

    const keepStatus = APPROVAL_PROCESSING_STATUSES.includes(
      enquiry.designStatus as (typeof APPROVAL_PROCESSING_STATUSES)[number],
    ) || enquiry.designStatus === 'APPROVED'

    await tx.enquiry.update({
      where: { id },
      data: {
        ...(keepStatus ? {} : { designStatus: 'IN_REVIEW' }),
        ductTags: data.ductTags,
        ductTotalQty: data.totalQty,
        ductTotalArea: data.totalArea,
        designNotes: normalizeDesignNotes(data.notes) || null,
      },
    })

    if (savedExcel) {
      const doc = await tx.enquiryDocument.create({
        data: {
          enquiryId: id,
          fileName: savedExcel.fileName,
          filePath: savedExcel.filePath,
          mimeType: savedExcel.mimeType,
          fileSize: savedExcel.fileSize,
          inputRevision: 0,
          isCurrent: true,
          category: 'duct_schedule',
        },
      })
      ductScheduleDocumentId = doc.id
    }
  })

  await syncLinkedCustomerOrderFromDuctLines(enquiry)

  await logActivity(id, {
    phase: 'design',
    title: `Duct schedule imported — ${formatRevision(enquiry.designRevision)}`,
    detail: designExtractionDetail(data),
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
    metadata: {
      lineCount: data.lines.length,
      excelFileName: data.excelFile?.fileName,
      ...(ductScheduleDocumentId ? { documentIds: [ductScheduleDocumentId] } : {}),
    },
  })

  return getEnquiryById(id)
}

async function latestDuctScheduleDocumentId(enquiryId: string): Promise<string | undefined> {
  const doc = await prisma.enquiryDocument.findFirst({
    where: { enquiryId, category: 'duct_schedule' },
    orderBy: { uploadedAt: 'desc' },
    select: { id: true },
  })
  return doc?.id
}

function hasDuctExtraction(enquiry: {
  ductTags: number | null
  ductTotalQty: number | null
  ductTotalArea: unknown
}): boolean {
  return Boolean(
    enquiry.ductTags &&
      enquiry.ductTotalQty &&
      enquiry.ductTotalArea != null &&
      Number(enquiry.ductTotalArea) > 0,
  )
}

export async function submitDesignToAccounts(id: string, actor: ActivityActor) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry || enquiry.designStatus !== 'IN_REVIEW') return null
  if (!hasDuctExtraction(enquiry)) return null

  const moved = await transitionEnquiryDesignStatus(id, ['IN_REVIEW'], {
    designStatus: 'SUBMITTED_TO_ACCOUNTS',
  })
  if (!moved) return null

  const ductDocId = await latestDuctScheduleDocumentId(id)

  await logActivity(id, {
    phase: 'design',
    title: `Submitted to accounts — ${formatRevision(enquiry.designRevision)}`,
    detail: 'Duct extraction sent for PO preparation (offline)',
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
    metadata: ductDocId ? { documentIds: [ductDocId] } : undefined,
  })

  return getEnquiryById(id)
}

export async function markPoForReview(id: string, actor: ActivityActor) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry || enquiry.designStatus !== 'SUBMITTED_TO_ACCOUNTS') return null

  const moved = await transitionEnquiryDesignStatus(id, ['SUBMITTED_TO_ACCOUNTS'], {
    designStatus: 'PO_FOR_REVIEW',
  })
  if (!moved) return null

  await logActivity(id, {
    phase: 'design',
    title: `PO sent for review — ${formatRevision(enquiry.designRevision)}`,
    detail: 'Accounts initiated client PO communication',
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
  })

  return getEnquiryById(id)
}

export async function markPoForApproval(id: string, actor: ActivityActor) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry || enquiry.designStatus !== 'PO_FOR_REVIEW') return null

  const moved = await transitionEnquiryDesignStatus(id, ['PO_FOR_REVIEW'], {
    designStatus: 'PO_FOR_APPROVAL',
  })
  if (!moved) return null

  await logActivity(id, {
    phase: 'design',
    title: `PO pending approval — ${formatRevision(enquiry.designRevision)}`,
    detail: 'Awaiting final PO approval',
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
  })

  return getEnquiryById(id)
}

export async function approveDesign(id: string, actor: ActivityActor) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry || enquiry.designStatus !== 'PO_FOR_APPROVAL') return null
  if (!hasDuctExtraction(enquiry)) return null

  const moved = await transitionEnquiryDesignStatus(id, ['PO_FOR_APPROVAL'], {
    designStatus: 'APPROVED',
    designReviewedBy: actor.name,
    designReviewDate: new Date(),
  })
  if (!moved) return null

  await logActivity(id, {
    phase: 'design',
    title: `PO approved — ${formatRevision(enquiry.designRevision)}`,
    detail: 'Ready for order conversion',
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
  })

  return getEnquiryById(id)
}

export async function requestDesignRevision(id: string, reason: string, actor: ActivityActor) {
  const guards = await enquiryWorkflowGuards(id)
  if (!guards) return null
  const { enquiry, orderDelivered } = guards
  if (!canRequestDesignRevision(enquiry.designStatus, orderDelivered)) return null

  const fromStatuses = [
    'IN_REVIEW',
    'APPROVED',
    ...APPROVAL_PROCESSING_STATUSES,
  ]
  const moved = await transitionEnquiryDesignStatus(id, fromStatuses, {
    designStatus: 'REVISION_NEEDED',
    designReviewedBy: null,
    designReviewDate: null,
    status: 'DESIGN_REVIEW',
  })
  if (!moved) return null

  await logActivity(id, {
    phase: 'design',
    title: `Revision requested — ${formatRevision(enquiry.designRevision)}`,
    detail: reason.trim() || 'Changes required — redesign task created',
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
  })

  return getEnquiryById(id)
}

export async function revertDesignWorkflowStep(id: string, reason: string, actor: ActivityActor) {
  const guards = await enquiryWorkflowGuards(id)
  if (!guards) return null
  const { enquiry, orderDelivered } = guards
  if (!canRevertDesignStep(enquiry.designStatus, orderDelivered)) return null

  const prev = previousDesignStatus(enquiry.designStatus)
  if (!prev) return null

  const clearApproval =
    enquiry.designStatus === 'APPROVED' ||
    prev === 'IN_REVIEW' ||
    APPROVAL_PROCESSING_STATUSES.includes(
      enquiry.designStatus as (typeof APPROVAL_PROCESSING_STATUSES)[number],
    )

  const moved = await transitionEnquiryDesignStatus(id, [enquiry.designStatus], {
    designStatus: prev,
    ...(clearApproval ? { designReviewedBy: null, designReviewDate: null } : {}),
    ...(prev === 'IN_REVIEW' ? { status: 'DESIGN_REVIEW' } : {}),
  })
  if (!moved) return null

  await logActivity(id, {
    phase: 'design',
    title: 'Workflow step back',
    detail:
      reason.trim() ||
      `${designStatusLabel(enquiry.designStatus)} → ${designStatusLabel(prev)}`,
    actor: actor.name,
    actorRole: actor.role,
    revision: enquiry.designRevision,
    metadata: { from: enquiry.designStatus, to: prev },
  })

  return getEnquiryById(id)
}

export async function returnToDesignFromApproval(
  id: string,
  reason: string,
  actor: ActivityActor,
) {
  const guards = await enquiryWorkflowGuards(id)
  if (!guards) return null
  const { enquiry, orderDelivered, hasDispatches } = guards
  const fromStatuses = [...APPROVAL_PROCESSING_STATUSES, 'APPROVED']
  if (!(fromStatuses as string[]).includes(enquiry.designStatus)) return null
  if (orderDelivered || hasDispatches) return null

  const nextRevision = enquiry.designRevision + 1
  const moved = await prisma.enquiry.updateMany({
    where: {
      id,
      designStatus: { in: fromStatuses },
    },
    data: {
      status: 'DESIGN_REVIEW',
      designStatus: 'IN_REVIEW',
      designRevision: nextRevision,
      designReviewedBy: null,
      designReviewDate: null,
    },
  })
  if (moved.count !== 1) return null

  if (enquiry.customerOrderId) {
    await prisma.customerOrder.updateMany({
      where: {
        id: enquiry.customerOrderId,
        status: { notIn: ['FULLY_DISPATCHED', 'CLOSED'] },
      },
      data: {
        status: 'CONFIRMED',
        productionApproved: false,
        productionApprovedBy: null,
        productionApprovedDate: null,
        straightDuctsCompleted: false,
        straightDuctsCompletedAt: null,
        straightDuctsCompletedBy: null,
        plasmaDuctsCompleted: false,
        plasmaDuctsCompletedAt: null,
        plasmaDuctsCompletedBy: null,
      },
    })
    await prisma.customerOrderItem.updateMany({
      where: { customerOrderId: enquiry.customerOrderId },
      data: { producedQty: 0, readyQty: 0 },
    })
  }

  await logActivity(id, {
    phase: 'design',
    title: `Returned to design — ${formatRevision(nextRevision)}`,
    detail: reason.trim() || 'Client requested design revision during approval',
    actor: actor.name,
    actorRole: actor.role,
    revision: nextRevision,
  })

  return getEnquiryById(id)
}

export async function resumeDesignRevision(id: string, actor: ActivityActor) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id } })
  if (!enquiry || enquiry.designStatus !== 'REVISION_NEEDED') return null

  const nextRevision = enquiry.designRevision + 1
  const moved = await prisma.enquiry.updateMany({
    where: { id, designStatus: 'REVISION_NEEDED' },
    data: {
      status: 'DESIGN_REVIEW',
      designStatus: 'IN_REVIEW',
      designRevision: nextRevision,
      designReviewedBy: null,
      designReviewDate: null,
    },
  })
  if (moved.count !== 1) return null

  await logActivity(id, {
    phase: 'design',
    title: `Design revision started — ${formatRevision(nextRevision)}`,
    actor: actor.name,
    actorRole: actor.role,
    revision: nextRevision,
  })

  return getEnquiryById(id)
}

function buildOrderItemsForEnquiry(enquiry: {
  ductTotalQty: number | null
  ductTotalArea: unknown
  ductTags: number | null
}, ductLines: DuctLineInput[]) {
  let totalQty = enquiry.ductTotalQty ?? 1
  let totalArea = Number(enquiry.ductTotalArea ?? 0)
  let items: ReturnType<typeof orderItemsFromDuctLines>

  if (ductLines.length > 0) {
    items = orderItemsFromDuctLines(ductLines)
    const totals = totalsFromDuctLines(ductLines)
    totalQty = totals.totalQty
    totalArea = totals.totalArea
  } else {
    const tagCount = Math.max(enquiry.ductTags ?? 1, 1)
    items = Array.from({ length: tagCount }, (_, i) => {
      const baseQty = Math.floor(totalQty / tagCount)
      const remainder = totalQty % tagCount
      const qty = baseQty + (i < remainder ? 1 : 0)
      const area = Math.round((totalArea / tagCount) * 100) / 100
      return {
        tagNo: String(i + 1),
        description: 'OFLINE',
        w1: 800,
        h1: 400,
        w2: 800,
        h2: 400,
        length: 900,
        orderedQty: qty || 1,
        area,
        producedQty: 0,
        readyQty: 0,
        dispatchedQty: 0,
      }
    })
  }

  return { items, totalQty, totalArea }
}

export async function convertToOrder(id: string, actor: ActivityActor) {
  const ductLines = await loadDuctLinesForEnquiry(id)

  const outcome = await runTransactionWithRetry(async (tx) => {
    await tx.$executeRaw`SELECT id FROM enquiries WHERE id = ${id} FOR UPDATE`

    const enquiry = await tx.enquiry.findUnique({
      where: { id },
      include: { customer: true },
    })
    if (!enquiry || enquiry.designStatus !== 'APPROVED') return null

    const standardOrderNo = formatCustomerOrderNo(enquiry.projectName, enquiry.enquiryNo)

    if (enquiry.customerOrderId) {
      const linked = await tx.customerOrder.findUnique({ where: { id: enquiry.customerOrderId } })
      if (linked) {
        return { kind: 'existing' as const, orderId: linked.id, orderNo: linked.orderNo, enquiry }
      }
    }

    let existingOrder: { id: string; orderNo: string } | null = null
    const byStandard = await tx.customerOrder.findUnique({ where: { orderNo: standardOrderNo } })
    if (byStandard) {
      const owner = await tx.enquiry.findFirst({
        where: { customerOrderId: byStandard.id },
        select: { id: true },
      })
      if (!owner || owner.id === id) existingOrder = byStandard
    }

    if (!existingOrder) {
      const byProjectName = await tx.customerOrder.findUnique({ where: { orderNo: enquiry.projectName } })
      if (byProjectName) {
        const owner = await tx.enquiry.findFirst({
          where: { customerOrderId: byProjectName.id },
          select: { id: true },
        })
        if (!owner || owner.id === id) existingOrder = byProjectName
      }
    }

    if (existingOrder) {
      const conflict = await tx.customerOrder.findUnique({ where: { orderNo: standardOrderNo } })
      if (!conflict && existingOrder.orderNo !== standardOrderNo) {
        existingOrder = await tx.customerOrder.update({
          where: { id: existingOrder.id },
          data: { orderNo: standardOrderNo },
        })
      }
      const linked = await tx.enquiry.updateMany({
        where: { id, designStatus: 'APPROVED' },
        data: { customerOrderId: existingOrder.id, status: 'CONVERTED' },
      })
      if (linked.count !== 1) return null
      return { kind: 'linked' as const, orderId: existingOrder.id, orderNo: existingOrder.orderNo, enquiry }
    }

    const { items, totalQty, totalArea } = buildOrderItemsForEnquiry(enquiry, ductLines)

    try {
      const order = await tx.customerOrder.create({
        data: {
          orderNo: standardOrderNo,
          customerId: enquiry.customerId,
          productionDate: new Date(),
          totalQuantity: totalQty,
          totalArea,
          status: 'IN_PRODUCTION',
          revision: 1,
          items: { create: items },
        },
      })

      const linked = await tx.enquiry.updateMany({
        where: { id, designStatus: 'APPROVED', customerOrderId: null },
        data: { customerOrderId: order.id, status: 'CONVERTED' },
      })
      if (linked.count !== 1) {
        throw new Error('Enquiry was converted by another request')
      }

      return {
        kind: 'created' as const,
        orderId: order.id,
        orderNo: order.orderNo,
        enquiry,
        totalQty,
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await tx.customerOrder.findUnique({ where: { orderNo: standardOrderNo } })
        if (!existing) throw error
        const linked = await tx.enquiry.updateMany({
          where: { id, designStatus: 'APPROVED' },
          data: { customerOrderId: existing.id, status: 'CONVERTED' },
        })
        if (linked.count !== 1) return null
        return { kind: 'linked' as const, orderId: existing.id, orderNo: existing.orderNo, enquiry }
      }
      throw error
    }
  })

  if (!outcome) return null

  await syncLinkedCustomerOrderFromDuctLines({
    id,
    customerOrderId: outcome.orderId,
    projectName: outcome.enquiry.projectName,
    enquiryNo: outcome.enquiry.enquiryNo,
  })

  if (outcome.kind === 'existing') {
    return getEnquiryById(id)
  }

  await logActivity(id, {
    phase: 'order',
    title: 'Converted to order',
    detail: outcome.orderNo,
    actor: actor.name,
    actorRole: actor.role,
  })

  if (outcome.kind === 'created') {
    await logActivity(id, {
      phase: 'production',
      title: 'Production order created',
      detail: `${outcome.orderNo} · ${outcome.totalQty} qty`,
      actor: actor.name,
      actorRole: actor.role,
    })
  }

  return getEnquiryById(id)
}
