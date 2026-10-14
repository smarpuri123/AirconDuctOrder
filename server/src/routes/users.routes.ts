import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PERMISSIONS } from '../lib/permissions.js'
import { ASSIGNABLE_PORTAL_ROLES } from '../lib/portal-role-job-map.js'
import { WORKFLOW_STAGES } from '../lib/org-defaults.js'
import {
  createPortalUser,
  listAllAssignablePortalUsers,
  listAssignablePortalUsersForStage,
  listPortalUsers,
  resetPortalUserPassword,
  updatePortalUser,
} from '../services/user.service.js'

const assignableRoleEnum = z.enum(
  ASSIGNABLE_PORTAL_ROLES as unknown as [string, ...string[]],
)

const createUserSchema = z.object({
  username: z.string().min(2).max(64),
  name: z.string().min(1).max(120),
  password: z.string().min(6).max(128),
  phone: z.string().max(32).optional(),
  email: z.string().email().optional(),
  roleCode: assignableRoleEnum,
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(32).optional(),
  active: z.boolean().optional(),
})

const resetPasswordSchema = z.object({
  password: z.string().min(6).max(128),
})

export async function userRoutes(app: FastifyInstance) {
  app.get(
    '/users/assignable',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const stage = (request.query as { stage?: string }).stage?.trim()
      if (stage) {
        if (!WORKFLOW_STAGES.includes(stage as typeof WORKFLOW_STAGES[number])) {
          return reply.code(400).send({ error: 'Invalid workflow stage' })
        }
        return listAssignablePortalUsersForStage(stage)
      }
      return listAllAssignablePortalUsers()
    },
  )

  app.get(
    '/users',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.USERS_MANAGE)] },
    async () => listPortalUsers(),
  )

  app.post(
    '/users',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.USERS_MANAGE)] },
    async (request, reply) => {
      try {
        const body = createUserSchema.parse(request.body)
        const user = await createPortalUser(body)
        return reply.code(201).send(user)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to create user'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.patch(
    '/users/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.USERS_MANAGE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = updateUserSchema.parse(request.body)
      const user = await updatePortalUser(id, body)
      if (!user) return reply.code(404).send({ error: 'User not found' })
      return user
    },
  )

  app.post(
    '/users/:id/reset-password',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.USERS_MANAGE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { password } = resetPasswordSchema.parse(request.body)
      await resetPortalUserPassword(id, password)
      return { ok: true }
    },
  )
}
