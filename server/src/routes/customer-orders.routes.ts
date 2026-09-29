import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PERMISSIONS } from '../lib/permissions.js'
import { mapOrderToFrontend } from '../lib/mappers.js'
import {
  listCustomerOrders,
  getCustomerOrderById,
  approveProductionStart,
  completeProductionProcess,
  markProductionReady,
  revertOrderWorkflowStep,
} from '../services/customer-order.service.js'
import { getEnquiryByOrderId } from '../services/enquiry.service.js'

import { activityActorFromRequest } from '../lib/operation-actor.js'

export async function customerOrderRoutes(app: FastifyInstance) {
  app.get(
    '/orders',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ORDERS_READ)] },
    async (request) => {
      const { status, search } = request.query as { status?: string; search?: string }
      const orders = await listCustomerOrders({ status, search })
      return orders.map((order) => mapOrderToFrontend(order))
    },
  )

  app.get(
    '/orders/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.ORDERS_READ)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const order = await getCustomerOrderById(id)
      if (!order) return reply.code(404).send({ error: 'Order not found' })
      const enquiry = await getEnquiryByOrderId(id)
      return { ...mapOrderToFrontend(order), enquiryId: enquiry?.id }
    },
  )

  app.post(
    '/orders/:id/approve-production',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.MANUFACTURING_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const order = await approveProductionStart(id, activityActorFromRequest(request))
      if (!order) return reply.code(404).send({ error: 'Order not found' })
      return mapOrderToFrontend(order)
    },
  )

  app.post(
    '/orders/:id/production-process',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.MANUFACTURING_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { process } = z
        .object({ process: z.enum(['straight_ducts', 'plasma_ducts']) })
        .parse(request.body)
      try {
        const order = await completeProductionProcess(id, process, activityActorFromRequest(request))
        if (!order) return reply.code(404).send({ error: 'Order not found' })
        return mapOrderToFrontend(order)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update production'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.post(
    '/orders/:id/mark-ready',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.MANUFACTURING_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const order = await markProductionReady(id, activityActorFromRequest(request))
        if (!order) return reply.code(404).send({ error: 'Order not found' })
        return mapOrderToFrontend(order)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to mark ready'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.post(
    '/orders/:id/revert-step',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.MANUFACTURING_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { reason } = z.object({ reason: z.string().default('') }).parse(request.body ?? {})
      const order = await revertOrderWorkflowStep(id, reason, activityActorFromRequest(request))
      if (!order) {
        return reply.code(400).send({
          error: 'Cannot step back (fully delivered, dispatches exist, or invalid stage)',
        })
      }
      return mapOrderToFrontend(order)
    },
  )
}
