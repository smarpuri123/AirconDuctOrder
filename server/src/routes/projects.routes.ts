import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { PERMISSIONS } from '../lib/permissions.js'
import { mapContactToApi } from '../lib/contact.js'

const projectBody = z.object({
  customerId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  projectType: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  expectedCompletion: z.string().optional(),
})

const projectContactBody = z.object({
  contactId: z.string().min(1),
  role: z.string().min(1),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
})

function mapProject(p: {
  id: string
  customerId: string
  code: string
  name: string
  projectType: string | null
  location: string | null
  description: string | null
  status: string
  startDate: Date | null
  expectedCompletion: Date | null
}) {
  return {
    id: p.id,
    customerId: p.customerId,
    code: p.code,
    name: p.name,
    projectType: p.projectType,
    location: p.location,
    description: p.description,
    status: p.status,
    startDate: p.startDate?.toISOString().split('T')[0],
    expectedCompletion: p.expectedCompletion?.toISOString().split('T')[0],
  }
}

export async function projectRoutes(app: FastifyInstance) {
  app.get(
    '/projects',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.PROJECTS_READ)] },
    async (request) => {
      const { customerId } = request.query as { customerId?: string }
      const projects = await prisma.project.findMany({
        where: customerId ? { customerId } : undefined,
        orderBy: { name: 'asc' },
      })
      return projects.map(mapProject)
    },
  )

  app.get(
    '/projects/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.PROJECTS_READ)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          projectContacts: {
            where: { isActive: true },
            include: { contact: true },
            orderBy: [{ isPrimary: 'desc' }, { role: 'asc' }],
          },
        },
      })
      if (!project) return reply.code(404).send({ error: 'Project not found' })
      return {
        ...mapProject(project),
        projectContacts: project.projectContacts.map((pc) => ({
          id: pc.id,
          projectId: pc.projectId,
          contactId: pc.contactId,
          role: pc.role,
          isPrimary: pc.isPrimary,
          isActive: pc.isActive,
          notes: pc.notes,
          contact: mapContactToApi(pc.contact),
        })),
      }
    },
  )

  app.post(
    '/projects',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.PROJECTS_WRITE)] },
    async (request, reply) => {
      const body = projectBody.parse(request.body)
      const project = await prisma.project.create({
        data: {
          customerId: body.customerId,
          code: body.code,
          name: body.name,
          projectType: body.projectType,
          location: body.location,
          description: body.description,
          status: body.status ?? 'ACTIVE',
          startDate: body.startDate ? new Date(body.startDate) : undefined,
          expectedCompletion: body.expectedCompletion ? new Date(body.expectedCompletion) : undefined,
        },
      })
      return reply.code(201).send(mapProject(project))
    },
  )

  app.patch(
    '/projects/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.PROJECTS_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = projectBody.partial().parse(request.body)
      const existing = await prisma.project.findUnique({ where: { id } })
      if (!existing) return reply.code(404).send({ error: 'Project not found' })

      const project = await prisma.project.update({
        where: { id },
        data: {
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.projectType !== undefined ? { projectType: body.projectType } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.startDate !== undefined
            ? { startDate: body.startDate ? new Date(body.startDate) : null }
            : {}),
          ...(body.expectedCompletion !== undefined
            ? { expectedCompletion: body.expectedCompletion ? new Date(body.expectedCompletion) : null }
            : {}),
        },
      })
      return mapProject(project)
    },
  )

  app.post(
    '/projects/:id/contacts',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.PROJECTS_WRITE)] },
    async (request, reply) => {
      const { id: projectId } = request.params as { id: string }
      const body = projectContactBody.parse(request.body)

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.code(404).send({ error: 'Project not found' })

      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, customerId: project.customerId },
      })
      if (!contact) {
        return reply.code(400).send({ error: 'Contact must belong to the same client as the project' })
      }

      if (body.isPrimary) {
        await prisma.projectContact.updateMany({
          where: { projectId, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      const pc = await prisma.projectContact.upsert({
        where: {
          projectId_contactId_role: {
            projectId,
            contactId: body.contactId,
            role: body.role,
          },
        },
        update: {
          isPrimary: body.isPrimary ?? false,
          isActive: body.isActive ?? true,
          notes: body.notes,
        },
        create: {
          projectId,
          contactId: body.contactId,
          role: body.role,
          isPrimary: body.isPrimary ?? false,
          isActive: body.isActive ?? true,
          notes: body.notes,
        },
        include: { contact: true },
      })

      return reply.code(201).send({
        id: pc.id,
        projectId: pc.projectId,
        contactId: pc.contactId,
        role: pc.role,
        isPrimary: pc.isPrimary,
        isActive: pc.isActive,
        notes: pc.notes,
        contact: mapContactToApi(pc.contact),
      })
    },
  )

  app.delete(
    '/projects/:projectId/contacts/:projectContactId',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.PROJECTS_WRITE)] },
    async (request, reply) => {
      const { projectContactId } = request.params as { projectId: string; projectContactId: string }
      await prisma.projectContact.update({
        where: { id: projectContactId },
        data: { isActive: false },
      })
      return reply.code(204).send()
    },
  )
}
