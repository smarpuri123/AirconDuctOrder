import type { FastifyInstance } from 'fastify'

import { z } from 'zod'

import { prisma } from '../lib/prisma.js'

import { PERMISSIONS } from '../lib/permissions.js'

import { mapContactToApi } from '../lib/contact.js'



const customerBody = z.object({

  name: z.string().min(1),

  code: z.string().optional(),

  email: z.union([z.string().email(), z.literal('')]).optional(),

  phone: z.string().optional(),

  address: z.string().optional(),

  city: z.string().optional(),

  state: z.string().optional(),

  country: z.string().optional(),

  gstin: z.string().optional(),

})



const contactBody = z.object({

  firstName: z.string().min(1),

  lastName: z.string().optional(),

  email: z.union([z.string().email(), z.literal('')]).optional(),

  phone: z.string().optional(),

  whatsapp: z.string().optional(),

  designation: z.string().optional(),

  department: z.string().optional(),

  isPrimary: z.boolean().optional(),

  active: z.boolean().optional(),

})



function mapCustomer(c: {

  id: string

  code: string | null

  name: string

  email: string | null

  phone: string | null

  address: string | null

  city: string | null

  state: string | null

  country: string | null

  gstin: string | null

  active: boolean

}) {

  return {

    id: c.id,

    code: c.code,

    name: c.name,

    email: c.email,

    phone: c.phone,

    address: c.address,

    city: c.city,

    state: c.state,

    country: c.country,

    gstin: c.gstin,

    active: c.active,

  }

}



export async function customerRoutes(app: FastifyInstance) {

  app.get(

    '/customers',

    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.CUSTOMERS_READ)] },

    async () => {

      const customers = await prisma.customer.findMany({

        where: { active: true },

        include: {

          contacts: { where: { active: true }, orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }] },

          projects: { orderBy: { name: 'asc' } },

        },

        orderBy: { name: 'asc' },

      })

      return customers.map((c) => ({

        ...mapCustomer(c),

        contacts: c.contacts.map(mapContactToApi),

        projects: c.projects.map((p) => ({

          id: p.id,

          customerId: p.customerId,

          code: p.code,

          name: p.name,

          location: p.location,

          status: p.status,

        })),

      }))

    },

  )



  app.get(

    '/customers/:id',

    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.CUSTOMERS_READ)] },

    async (request, reply) => {

      const { id } = request.params as { id: string }

      const customer = await prisma.customer.findUnique({

        where: { id },

        include: {

          contacts: { orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }] },

          projects: { orderBy: { name: 'asc' } },

        },

      })

      if (!customer) return reply.code(404).send({ error: 'Customer not found' })

      return {

        ...mapCustomer(customer),

        contacts: customer.contacts.map(mapContactToApi),

        projects: customer.projects.map((p) => ({

          id: p.id,

          customerId: p.customerId,

          code: p.code,

          name: p.name,

          projectType: p.projectType,

          location: p.location,

          status: p.status,

        })),

      }

    },

  )



  app.post(

    '/customers',

    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.CUSTOMERS_WRITE)] },

    async (request, reply) => {

      const body = customerBody.parse(request.body)

      const code =

        body.code?.trim() ||

        body.name.replace(/\s+/g, '-').toUpperCase().slice(0, 20)

      const emptyToNull = (v?: string) => (v?.trim() ? v.trim() : null)

      const customer = await prisma.customer.create({

        data: {
          name: body.name.trim(),
          code,
          email: emptyToNull(body.email),
          phone: emptyToNull(body.phone),
          address: emptyToNull(body.address),
          city: emptyToNull(body.city),
          state: emptyToNull(body.state),
          country: emptyToNull(body.country),
          gstin: emptyToNull(body.gstin),
          active: true,
        },

      })

      return reply.code(201).send(mapCustomer(customer))

    },

  )



  app.patch(

    '/customers/:id',

    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.CUSTOMERS_WRITE)] },

    async (request, reply) => {

      const { id } = request.params as { id: string }

      const body = customerBody.partial().parse(request.body)

      const existing = await prisma.customer.findUnique({ where: { id } })

      if (!existing) return reply.code(404).send({ error: 'Customer not found' })

      const emptyToNull = (v?: string) => (v === undefined ? undefined : v?.trim() ? v.trim() : null)

      const customer = await prisma.customer.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.code !== undefined ? { code: emptyToNull(body.code) } : {}),
          ...(body.email !== undefined ? { email: emptyToNull(body.email) } : {}),
          ...(body.phone !== undefined ? { phone: emptyToNull(body.phone) } : {}),
          ...(body.address !== undefined ? { address: emptyToNull(body.address) } : {}),
          ...(body.city !== undefined ? { city: emptyToNull(body.city) } : {}),
          ...(body.state !== undefined ? { state: emptyToNull(body.state) } : {}),
          ...(body.country !== undefined ? { country: emptyToNull(body.country) } : {}),
          ...(body.gstin !== undefined ? { gstin: emptyToNull(body.gstin) } : {}),
        },
      })

      return mapCustomer(customer)

    },

  )



  app.post(

    '/customers/:id/contacts',

    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.CUSTOMERS_WRITE)] },

    async (request, reply) => {

      const { id: customerId } = request.params as { id: string }

      const body = contactBody.parse(request.body)



      const customer = await prisma.customer.findUnique({ where: { id: customerId } })

      if (!customer) return reply.code(404).send({ error: 'Customer not found' })



      if (body.isPrimary) {

        await prisma.contact.updateMany({

          where: { customerId, isPrimary: true },

          data: { isPrimary: false },

        })

      }



      const contact = await prisma.contact.create({

        data: {

          customerId,

          firstName: body.firstName,

          lastName: body.lastName,

          email: body.email,

          phone: body.phone,

          whatsapp: body.whatsapp,

          designation: body.designation,

          department: body.department,

          isPrimary: body.isPrimary ?? false,

          active: body.active ?? true,

        },

      })

      return reply.code(201).send(mapContactToApi(contact))

    },

  )



  app.patch(

    '/customers/:customerId/contacts/:contactId',

    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.CUSTOMERS_WRITE)] },

    async (request, reply) => {

      const { customerId, contactId } = request.params as { customerId: string; contactId: string }

      const body = contactBody.partial().parse(request.body)



      const existing = await prisma.contact.findFirst({ where: { id: contactId, customerId } })

      if (!existing) return reply.code(404).send({ error: 'Contact not found' })



      if (body.isPrimary) {

        await prisma.contact.updateMany({

          where: { customerId, isPrimary: true },

          data: { isPrimary: false },

        })

      }



      const contact = await prisma.contact.update({

        where: { id: contactId },

        data: body,

      })

      return mapContactToApi(contact)

    },

  )

}


