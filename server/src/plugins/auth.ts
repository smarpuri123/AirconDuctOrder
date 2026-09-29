import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { config } from '../config.js'
import type { PermissionCode } from '../lib/permissions.js'
import { attachOperationActor } from '../lib/operation-actor.js'
import type { AuthUser } from '../types/fastify.js'

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  })

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      request.authUser = request.user as AuthUser
      attachOperationActor(request)
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
    }
  })

  app.decorate(
    'authorize',
    (permission: PermissionCode) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.authUser ?? (request.user as AuthUser | undefined)
        if (!user) {
          return reply.code(401).send({ error: 'Unauthorized' })
        }
        if (user.roles.includes('ADMIN') || user.permissions.includes(permission)) {
          return
        }
        return reply.code(403).send({ error: 'Forbidden', message: `Requires permission: ${permission}` })
      },
  )
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    authorize: (permission: PermissionCode) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
