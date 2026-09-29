import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { PERMISSIONS } from '../lib/permissions.js'
import { WORKFLOW_STAGES } from '../lib/org-defaults.js'

function mapEmployee(e: {
  id: string
  name: string
  email: string | null
  phone: string | null
  employeeCode: string | null
  departmentId: string | null
  active: boolean
  department: { id: string; code: string; name: string } | null
  jobRoles: Array<{ isPrimary: boolean; jobRole: { id: string; code: string; label: string } }>
}) {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    employeeCode: e.employeeCode,
    departmentId: e.departmentId,
    departmentName: e.department?.name,
    active: e.active,
    jobRoles: e.jobRoles.map((jr) => ({
      code: jr.jobRole.code,
      label: jr.jobRole.label,
      isPrimary: jr.isPrimary,
    })),
  }
}

const employeeInclude = {
  department: true,
  jobRoles: { include: { jobRole: true } },
}

export async function orgRoutes(app: FastifyInstance) {
  app.get(
    '/org/departments',
    { preHandler: [app.authenticate] },
    async () => {
      return prisma.department.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      })
    },
  )

  app.post(
    '/org/departments',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const body = z
        .object({ code: z.string().min(1), name: z.string().min(1), sortOrder: z.number().int().optional() })
        .parse(request.body)
      const row = await prisma.department.create({
        data: { code: body.code.toUpperCase(), name: body.name, sortOrder: body.sortOrder ?? 0, active: true },
      })
      return reply.code(201).send(row)
    },
  )

  app.get(
    '/org/job-roles',
    { preHandler: [app.authenticate] },
    async () => {
      return prisma.jobRole.findMany({
        where: { active: true },
        include: { department: true },
        orderBy: { sortOrder: 'asc' },
      })
    },
  )

  app.post(
    '/org/job-roles',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const body = z
        .object({
          code: z.string().min(1),
          label: z.string().min(1),
          departmentId: z.string().optional(),
          sortOrder: z.number().int().optional(),
        })
        .parse(request.body)
      const row = await prisma.jobRole.create({
        data: {
          code: body.code.toUpperCase(),
          label: body.label,
          departmentId: body.departmentId,
          sortOrder: body.sortOrder ?? 0,
          active: true,
        },
      })
      return reply.code(201).send(row)
    },
  )

  app.get(
    '/org/employees',
    { preHandler: [app.authenticate] },
    async () => {
      const rows = await prisma.employee.findMany({
        where: { active: true },
        include: employeeInclude,
        orderBy: { name: 'asc' },
      })
      return rows.map(mapEmployee)
    },
  )

  app.get(
    '/org/employees/for-stage/:stageCode',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { stageCode } = request.params as { stageCode: string }
      if (!WORKFLOW_STAGES.includes(stageCode as typeof WORKFLOW_STAGES[number])) {
        return reply.code(400).send({ error: 'Invalid stage' })
      }
      const stageRoles = await prisma.workflowStageRole.findMany({
        where: { stageCode },
        include: { jobRole: true },
      })
      const roleIds = stageRoles.map((s) => s.jobRoleId)
      if (!roleIds.length) {
        const all = await prisma.employee.findMany({ where: { active: true }, include: employeeInclude })
        return all.map(mapEmployee)
      }
      const employees = await prisma.employee.findMany({
        where: { active: true, jobRoles: { some: { jobRoleId: { in: roleIds } } } },
        include: employeeInclude,
        orderBy: { name: 'asc' },
      })
      return employees.map(mapEmployee)
    },
  )

  app.post(
    '/org/employees',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const body = z
        .object({
          name: z.string().min(1),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          employeeCode: z.string().optional(),
          departmentId: z.string().optional(),
          jobRoleCodes: z.array(z.string()).optional(),
        })
        .parse(request.body)

      const employee = await prisma.employee.create({
        data: {
          name: body.name,
          email: body.email,
          phone: body.phone,
          employeeCode: body.employeeCode,
          departmentId: body.departmentId,
          active: true,
        },
      })

      if (body.jobRoleCodes?.length) {
        const roles = await prisma.jobRole.findMany({
          where: { code: { in: body.jobRoleCodes.map((c) => c.toUpperCase()) } },
        })
        for (const [i, role] of roles.entries()) {
          await prisma.employeeJobRole.create({
            data: { employeeId: employee.id, jobRoleId: role.id, isPrimary: i === 0 },
          })
        }
      }

      const full = await prisma.employee.findUnique({
        where: { id: employee.id },
        include: employeeInclude,
      })
      return reply.code(201).send(full ? mapEmployee(full) : employee)
    },
  )

  app.patch(
    '/org/employees/:id/roles',
    { preHandler: [app.authenticate, app.authorize(PERMISSIONS.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { jobRoleCodes } = z.object({ jobRoleCodes: z.array(z.string()) }).parse(request.body)
      const employee = await prisma.employee.findUnique({ where: { id } })
      if (!employee) return reply.code(404).send({ error: 'Employee not found' })

      await prisma.employeeJobRole.deleteMany({ where: { employeeId: id } })
      const roles = await prisma.jobRole.findMany({
        where: { code: { in: jobRoleCodes.map((c) => c.toUpperCase()) } },
      })
      for (const [i, role] of roles.entries()) {
        await prisma.employeeJobRole.create({
          data: { employeeId: id, jobRoleId: role.id, isPrimary: i === 0 },
        })
      }
      const full = await prisma.employee.findUnique({ where: { id }, include: employeeInclude })
      return full ? mapEmployee(full) : null
    },
  )

  app.get(
    '/org/workflow-stage-roles',
    { preHandler: [app.authenticate] },
    async () => {
      return prisma.workflowStageRole.findMany({ include: { jobRole: true } })
    },
  )
}
