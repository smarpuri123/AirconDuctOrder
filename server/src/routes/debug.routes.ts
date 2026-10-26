import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { config } from '../config.js'
import {
  clientPortalLogCapacity,
  clearClientPortalLogs,
  listClientPortalLogs,
  pushClientPortalLog,
} from '../lib/client-log-buffer.js'
import {
  apiRequestLogCapacity,
  clearApiRequestLogs,
  listApiRequestLogs,
} from '../lib/request-log-buffer.js'
import type { AuthUser } from '../types/fastify.js'

const clientLogBodySchema = z.object({
  kind: z.enum(['api', 'error', 'info', 'auth', 'excel', 'network']),
  message: z.string().min(1).max(500),
  method: z.string().max(20).optional(),
  path: z.string().max(500).optional(),
  status: z.number().int().optional(),
  durationMs: z.number().int().optional(),
  detail: z.string().max(4000).optional(),
  route: z.string().max(500).optional(),
  pageUrl: z.string().max(2000).optional(),
})

function optionalAuthUser(request: FastifyRequest): AuthUser | null {
  try {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return null
    const decoded = request.server.jwt.verify<AuthUser>(auth.slice(7))
    return decoded
  } catch {
    return null
  }
}

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

  app.post('/debug/client-logs', async (request, reply) => {
    const parsed = clientLogBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid client log payload' })
    }
    if (parsed.data.kind === 'info') {
      return reply.code(204).send()
    }

    const user = optionalAuthUser(request)
    const ua = request.headers['user-agent']

    pushClientPortalLog({
      kind: parsed.data.kind,
      message: parsed.data.message,
      method: parsed.data.method,
      path: parsed.data.path,
      status: parsed.data.status,
      durationMs: parsed.data.durationMs,
      detail: parsed.data.detail,
      route: parsed.data.route,
      pageUrl: parsed.data.pageUrl,
      userAgent: typeof ua === 'string' ? ua.slice(0, 500) : undefined,
      userId: user?.id ?? null,
      username: user?.username ?? null,
    })

    return reply.code(204).send()
  })

  app.get(
    '/debug/client-logs',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return
      const q = request.query as { limit?: string; kind?: string }
      const limit = Math.min(Number(q.limit) || 200, 400)
      let entries = listClientPortalLogs(limit)
      if (q.kind && q.kind !== 'all') {
        entries = entries.filter((e) => e.kind === q.kind)
      }
      return {
        entries,
        capacity: clientPortalLogCapacity,
      }
    },
  )

  app.post(
    '/debug/client-logs/clear',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return
      clearClientPortalLogs()
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
          inMemoryClientPortalLogBuffer: true,
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
