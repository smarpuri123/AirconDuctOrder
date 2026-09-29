import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PERMISSIONS } from '../lib/permissions.js'
import {
  createDispatch,
  listDispatches,
  getDispatchById,
  updateDispatchStatus,
} from '../services/dispatch.service.js'
import { notifyDispatchCreated, notifyDispatchStatusUpdated } from '../lib/dispatch-notifications.js'

const createDispatchSchema = z.object({
  customerOrderId: z.string(),
  vehicle: z.object({
    vehicleNumber: z.string().min(1),
    driverName: z.string().min(1),
    driverMobile: z.string().min(1),
    transporter: z.string().min(1),
    vehicleType: z.string().min(1),
    loadingDate: z.string(),
    loadingTime: z.string(),
    lrNumber: z.string().optional(),
    ewayBillNumber: z.string().optional(),
    destination: z.string().optional(),
    remarks: z.string().optional(),
  }),
  items: z.record(z.string(), z.number()),
})

export async function dispatchRoutes(app: FastifyInstance) {
  app.get(
    '/dispatches',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.DISPATCHES_READ)] },
    async () => {
      const dispatches = await listDispatches()
      return dispatches.map(mapDispatchResponse)
    },
  )

  app.get(
    '/dispatches/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.DISPATCHES_READ)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const dispatch = await getDispatchById(id)
      if (!dispatch) return reply.code(404).send({ error: 'Dispatch not found' })
      return mapDispatchResponse(dispatch)
    },
  )

  app.post(
    '/dispatches',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.DISPATCHES_WRITE)] },
    async (request, reply) => {
      const body = createDispatchSchema.parse(request.body)
      const user = request.authUser!

      const items = Object.entries(body.items)
        .filter(([, qty]) => qty > 0)
        .map(([customerOrderItemId, quantity]) => ({ customerOrderItemId, quantity }))

      try {
        const dispatch = await createDispatch({
          customerOrderId: body.customerOrderId,
          createdById: user.id,
          vehicle: body.vehicle,
          items,
        })
        notifyDispatchCreated({
          dispatchId: dispatch.id,
          dispatchNo: dispatch.dispatchNo,
          orderNo: dispatch.customerOrder.orderNo,
          actorUserId: user.id,
        })
        return mapDispatchResponse(dispatch)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create dispatch'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.patch(
    '/dispatches/:id',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.DISPATCHES_WRITE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { status } = z.object({ status: z.string().min(1) }).parse(request.body)

      try {
        const dispatch = await updateDispatchStatus(id, status)
        notifyDispatchStatusUpdated({
          dispatchId: dispatch.id,
          dispatchNo: dispatch.dispatchNo,
          status: dispatch.status,
          actorUserId: request.authUser?.id,
        })
        return mapDispatchResponse(dispatch)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update dispatch'
        return reply.code(400).send({ error: message })
      }
    },
  )
}

type DispatchRecord = NonNullable<Awaited<ReturnType<typeof getDispatchById>>> | Awaited<ReturnType<typeof listDispatches>>[number]

function mapDispatchResponse(dispatch: DispatchRecord) {
  return {
    id: dispatch.id,
    dispatchNo: dispatch.dispatchNo,
    orderId: dispatch.customerOrderId,
    orderNo: dispatch.customerOrder.orderNo,
    customerName: dispatch.customerOrder.customer.name,
    vehicle: {
      vehicleNumber: dispatch.vehicleNumber ?? '',
      driverName: dispatch.driverName ?? '',
      driverMobile: dispatch.driverMobile ?? '',
      transporter: dispatch.transporter ?? '',
      vehicleType: dispatch.vehicleType ?? '',
      loadingDate: dispatch.loadingDate?.toISOString().split('T')[0] ?? '',
      loadingTime: dispatch.loadingTime ?? '',
      lrNumber: dispatch.lrNumber,
      ewayBillNumber: dispatch.ewayBillNumber,
      destination: dispatch.destination,
      remarks: dispatch.remarks,
    },
    items: dispatch.items.map((item) => ({
      orderItemId: item.customerOrderItemId,
      tagNo: parseInt(item.customerOrderItem.tagNo, 10) || 0,
      description: item.customerOrderItem.description,
      w1: item.customerOrderItem.w1,
      h1: item.customerOrderItem.h1,
      w2: item.customerOrderItem.w2,
      h2: item.customerOrderItem.h2,
      length: item.customerOrderItem.length,
      quantity: item.quantity,
      area: Number(item.area),
    })),
    totalQuantity: dispatch.totalQuantity,
    totalArea: Number(dispatch.totalArea),
    status: dispatch.status.toLowerCase(),
    dispatchDate: dispatch.dispatchDate.toISOString().split('T')[0],
    createdAt: dispatch.createdAt.toISOString(),
  }
}
