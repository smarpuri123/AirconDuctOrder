import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { PERMISSIONS } from '../lib/permissions.js'
import { DEFAULT_MASTER_LOOKUPS } from '../lib/master-defaults.js'

export async function masterRoutes(app: FastifyInstance) {
  app.get(
    '/masters',
    { preHandler: [app.authenticate] },
    async (request) => {
      const { category } = request.query as { category?: string }
      const rows = await prisma.masterLookup.findMany({
        where: {
          active: true,
          ...(category ? { category } : {}),
        },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
      })
      return rows.map((r) => ({
        id: r.id,
        category: r.category,
        code: r.code,
        label: r.label,
        sortOrder: r.sortOrder,
        active: r.active,
      }))
    },
  )

  app.post(
    '/masters',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const body = z
        .object({
          category: z.string().min(1),
          code: z.string().min(1),
          label: z.string().min(1),
          sortOrder: z.number().int().optional(),
        })
        .parse(request.body)

      const row = await prisma.masterLookup.create({
        data: {
          category: body.category,
          code: body.code.toUpperCase(),
          label: body.label,
          sortOrder: body.sortOrder ?? 0,
          active: true,
        },
      })
      return reply.code(201).send(row)
    },
  )

  app.patch(
    '/masters/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.SETTINGS_MANAGE)] },
    async (request) => {
      const { id } = request.params as { id: string }
      const body = z
        .object({
          label: z.string().min(1).optional(),
          sortOrder: z.number().int().optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body)

      return prisma.masterLookup.update({ where: { id }, data: body })
    },
  )

  app.post(
    '/masters/seed-defaults',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.SETTINGS_MANAGE)] },
    async () => {
      for (const item of DEFAULT_MASTER_LOOKUPS) {
        await prisma.masterLookup.upsert({
          where: { category_code: { category: item.category, code: item.code } },
          update: { label: item.label, sortOrder: item.sortOrder, active: true },
          create: { ...item, active: true },
        })
      }
      return { ok: true }
    },
  )
}
