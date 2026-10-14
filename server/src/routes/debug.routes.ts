import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config.js'
import {
  apiRequestLogCapacity,
  clearApiRequestLogs,
  listApiRequestLogs,
} from '../lib/request-log-buffer.js'

function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  const user = request.authUser
  if (!user?.roles.includes('ADMIN')) {
    reply.code(403).send({ error: 'Forbidden', message: 'Administrator access only' })
    return false
  }
  return true
}

export async function debugRoutes(app: FastifyInstance) {
  app.get(
    '/debug/logs',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return
      const limit = Math.min(Number((request.query as { limit?: string }).limit) || 200, 400)
      return {
        entries: listApiRequestLogs(limit),
        capacity: apiRequestLogCapacity,
      }
    },
  )

  app.post(
    '/debug/logs/clear',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return
      clearApiRequestLogs()
      return { ok: true }
    },
  )

  app.get(
    '/debug/info',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return
      return {
        service: 'ecovent-api',
        nodeEnv: config.nodeEnv,
        uptimeSeconds: Math.floor(process.uptime()),
        pid: process.pid,
        logging: {
          inMemoryRequestBuffer: true,
          fastifyLogger: config.nodeEnv !== 'test',
          fastifyLogDestination:
            'Process stdout/stderr (container or host logs in production — not shown in this UI)',
          databaseAuditLog: 'audit_logs table exists but is not written by current API handlers',
          enquiryActivity: 'Per-enquiry workflow entries in enquiry_activities (see enquiry detail)',
        },
      }
    },
  )
}
