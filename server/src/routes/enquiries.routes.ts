import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PERMISSIONS } from '../lib/permissions.js'
import {
  listEnquiries,
  getEnquiryById,
  createEnquiry,
  startDesignReview,
  saveDesignExtraction,
  saveDuctScheduleImport,
  approveDesign,
  submitDesignToAccounts,
  markPoForReview,
  markPoForApproval,
  requestDesignRevision,
  resumeDesignRevision,
  returnToDesignFromApproval,
  revertDesignWorkflowStep,
  convertToOrder,
  attachEnquiryInputFiles,
  completeEnquiryIntake,
  acceptEnquiryAndAssignDesign,
  getEnquiryDocument,
} from '../services/enquiry.service.js'
import { readEnquiryFile } from '../lib/enquiry-files.js'
import { activityActorFromRequest } from '../lib/operation-actor.js'
import { resolveDesignerEnquiryListScope } from '../lib/enquiry-access.js'
import { guardEnquiryAssignedToUser } from './enquiry-access-guard.js'

function canManageAccountsWorkflow(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('ACCOUNTS')
}

const createEnquirySchema = z
  .object({
    customerId: z.string().optional(),
    projectId: z.string().optional(),
    contactId: z.string().optional(),
    projectContactRole: z.string().optional(),
    customerName: z.string().optional(),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    projectName: z.string().optional(),
    location: z.string().optional(),
    enquiryDate: z.string(),
    expectedCompletion: z.string().optional(),
    salesPerson: z.string().optional(),
    personInChargeId: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    source: z.string().optional(),
    remarks: z.string().optional(),
    drawingFile: z.string().optional(),
    files: z
      .array(
        z.object({
          fileName: z.string().min(1),
          mimeType: z.string().optional(),
          dataBase64: z.string().min(1),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => Boolean(data.customerId || data.customerName?.trim()),
    { message: 'Client is required', path: ['customerId'] },
  )
  .refine(
    (data) => Boolean(data.projectId || data.projectName?.trim()),
    { message: 'Project is required', path: ['projectId'] },
  )

const uploadFilesSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.string().optional(),
        dataBase64: z.string().min(1),
      }),
    )
    .min(1),
})

const extractionSchema = z.object({
  ductTags: z.number().int().positive(),
  totalQty: z.number().int().positive(),
  totalArea: z.number().positive(),
  notes: z.string().optional(),
})

const ductLineSchema = z.object({
  tagNo: z.string().min(1),
  description: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  length: z.number().int().positive(),
  quantity: z.number().int().positive(),
  area: z.number().optional(),
  gauge: z.number().int().optional(),
  dai: z.number().optional(),
  rmt: z.number().optional(),
})

const ductImportSchema = extractionSchema.extend({
  lines: z.array(ductLineSchema).min(1),
  excelFile: z
    .object({
      fileName: z.string().min(1),
      mimeType: z.string().optional(),
      dataBase64: z.string().min(1),
    })
    .optional(),
})

export async function enquiryRoutes(app: FastifyInstance) {
  app.get(
    '/enquiries',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_READ)] },
    async (request) => {
      const scope = await resolveDesignerEnquiryListScope(request.authUser!)
      return listEnquiries(scope)
    },
  )

  app.get(
    '/enquiries/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_READ)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const enquiry = await getEnquiryById(id)
      if (!enquiry) return reply.code(404).send({ error: 'Enquiry not found' })
      return enquiry
    },
  )

  app.post(
    '/enquiries',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const body = createEnquirySchema.parse(request.body)
      try {
        const enquiry = await createEnquiry(body, activityActorFromRequest(request))
        return reply.code(201).send(enquiry)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create enquiry'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.post(
    '/enquiries/:id/documents',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const body = uploadFilesSchema.parse(request.body)
      try {
        const enquiry = await attachEnquiryInputFiles(id, body.files, activityActorFromRequest(request))
        if (!enquiry) return reply.code(404).send({ error: 'Enquiry not found' })
        return enquiry
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.get(
    '/enquiries/:enquiryId/documents/:documentId/download',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_READ)] },
    async (request, reply) => {
      const { enquiryId, documentId } = request.params as { enquiryId: string; documentId: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, enquiryId))) return
      const doc = await getEnquiryDocument(enquiryId, documentId)
      if (!doc) return reply.code(404).send({ error: 'File not found' })
      const buffer = await readEnquiryFile(doc.filePath)
      return reply
        .header('Content-Type', doc.mimeType ?? 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${doc.fileName}"`)
        .send(buffer)
    },
  )

  app.post(
    '/enquiries/:id/intake/complete',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const body = z
        .object({
          assigneeId: z.string().min(1).optional(),
          assigneeRoleCode: z.string().optional(),
        })
        .parse(request.body ?? {})
      const actor = activityActorFromRequest(request)
      try {
        const enquiry = body.assigneeId
          ? await acceptEnquiryAndAssignDesign(id, actor, {
              assigneeId: body.assigneeId,
              assigneeRoleCode: body.assigneeRoleCode,
            })
          : await completeEnquiryIntake(id, actor)
        if (!enquiry) return reply.code(404).send({ error: 'Enquiry not found' })
        return enquiry
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to complete intake'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.post(
    '/enquiries/:id/design/start',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = z
        .object({
          assigneeId: z.string().min(1),
          assigneeRoleCode: z.string().optional(),
        })
        .parse(request.body)
      try {
        const enquiry = await startDesignReview(id, activityActorFromRequest(request), body)
        if (!enquiry) return reply.code(404).send({ error: 'Enquiry not found' })
        return enquiry
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start design review'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.patch(
    '/enquiries/:id/design/extraction',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const body = extractionSchema.parse(request.body)
      const enquiry = await saveDesignExtraction(id, body, activityActorFromRequest(request))
      if (!enquiry) return reply.code(404).send({ error: 'Enquiry not found' })
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/duct-import',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const body = ductImportSchema.parse(request.body)
      const enquiry = await saveDuctScheduleImport(id, body, activityActorFromRequest(request))
      if (!enquiry) {
        return reply.code(400).send({ error: 'Could not save duct import for this enquiry' })
      }
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/submit-to-accounts',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const enquiry = await submitDesignToAccounts(id, activityActorFromRequest(request))
      if (!enquiry) {
        return reply.code(400).send({ error: 'Save duct extraction before submitting to accounts' })
      }
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/po-for-review',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      if (!canManageAccountsWorkflow(request.authUser!.roles)) {
        return reply.code(403).send({ error: 'Accounts or admin access required' })
      }
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const enquiry = await markPoForReview(id, activityActorFromRequest(request))
      if (!enquiry) return reply.code(400).send({ error: 'Enquiry must be submitted to accounts first' })
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/po-for-approval',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      if (!canManageAccountsWorkflow(request.authUser!.roles)) {
        return reply.code(403).send({ error: 'Accounts or admin access required' })
      }
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const enquiry = await markPoForApproval(id, activityActorFromRequest(request))
      if (!enquiry) return reply.code(400).send({ error: 'PO must be in review stage first' })
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/approve',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      if (!canManageAccountsWorkflow(request.authUser!.roles)) {
        return reply.code(403).send({ error: 'Accounts or admin access required' })
      }
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const enquiry = await approveDesign(id, activityActorFromRequest(request))
      if (!enquiry) {
        return reply.code(400).send({ error: 'PO must be pending approval before final sign-off' })
      }
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/request-revision',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const { reason } = z.object({ reason: z.string() }).parse(request.body)
      const enquiry = await requestDesignRevision(id, reason, activityActorFromRequest(request))
      if (!enquiry) return reply.code(400).send({ error: 'Cannot request revision for this enquiry' })
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/resume-revision',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const enquiry = await resumeDesignRevision(id, activityActorFromRequest(request))
      if (!enquiry) return reply.code(400).send({ error: 'Enquiry is not awaiting revision' })
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/return-to-design',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const { reason } = z.object({ reason: z.string().default('') }).parse(request.body ?? {})
      const enquiry = await returnToDesignFromApproval(id, reason, activityActorFromRequest(request))
      if (!enquiry) {
        return reply.code(400).send({
          error:
            'Cannot return to design (delivered orders, active dispatches, or invalid stage)',
        })
      }
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/design/revert-step',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ENQUIRIES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const { reason } = z.object({ reason: z.string().default('') }).parse(request.body ?? {})
      const enquiry = await revertDesignWorkflowStep(id, reason, activityActorFromRequest(request))
      if (!enquiry) {
        return reply.code(400).send({ error: 'Cannot step back from the current design stage' })
      }
      return enquiry
    },
  )

  app.post(
    '/enquiries/:id/convert-to-order',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ORDERS_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!(await guardEnquiryAssignedToUser(request, reply, id))) return
      const enquiry = await convertToOrder(id, activityActorFromRequest(request))
      if (!enquiry) return reply.code(400).send({ error: 'Design must be approved before conversion' })
      return enquiry
    },
  )
}
