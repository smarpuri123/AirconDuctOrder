import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { PERMISSIONS, ROLE_DEFINITIONS } from '../src/lib/permissions.js'
import { DEFAULT_MASTER_LOOKUPS } from '../src/lib/master-defaults.js'
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_JOB_ROLES,
  DEFAULT_STAGE_ROLE_MAP,
} from '../src/lib/org-defaults.js'

export const prisma = new PrismaClient()
const __dirname = dirname(fileURLToPath(import.meta.url))

/** When false (default), seed only auth/org/masters — no demo clients, orders, or enquiries. */
function shouldSeedDemoBusinessData(): boolean {
  return process.env.SEED_DEMO_DATA === 'true' || process.env.SEED_DEMO_DATA === '1'
}

function mapOrderStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'DRAFT',
    imported: 'IMPORTED',
    production: 'IN_PRODUCTION',
    ready: 'READY',
    partially_dispatched: 'PARTIALLY_DISPATCHED',
    fully_dispatched: 'FULLY_DISPATCHED',
    closed: 'CLOSED',
    cancelled: 'CANCELLED',
    confirmed: 'CONFIRMED',
  }
  return map[status.toLowerCase()] ?? status.toUpperCase()
}

async function seedRolesAndPermissions() {
  for (const [code, def] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: def.name, description: def.description },
      create: { code, name: def.name, description: def.description },
    })

    for (const permCode of def.permissions) {
      const module = permCode.split(':')[0]
      const permission = await prisma.permission.upsert({
        where: { code: permCode },
        update: {},
        create: {
          code: permCode,
          name: permCode.replace(':', ' ').replace(/_/g, ' '),
          module,
        },
      })

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      })
    }
  }

  // Ensure every permission exists even if not assigned
  for (const permCode of Object.values(PERMISSIONS)) {
    const module = permCode.split(':')[0]
    await prisma.permission.upsert({
      where: { code: permCode },
      update: {},
      create: {
        code: permCode,
        name: permCode.replace(':', ' ').replace(/_/g, ' '),
        module,
      },
    })
  }
}

async function seedUsers() {
  const users = [
    { username: 'admin', email: 'admin@ecovent.com', password: 'admin@123', name: 'System Admin', role: 'ADMIN' },
    { username: 'supervisor', email: 'supervisor@ecovent.com', password: 'supervisor@123', name: 'Operations Supervisor', role: 'SUPERVISOR' },
    { username: 'designer', email: 'designer@ecovent.com', password: 'designer@123', name: 'Design Engineer', role: 'DESIGNER' },
    { username: 'accounts', email: 'accounts@ecovent.com', password: 'accounts@123', name: 'Accounts User', role: 'ACCOUNTS' },
    { username: 'production', email: 'production@ecovent.com', password: 'production@123', name: 'Production Lead', role: 'PRODUCTION' },
    { username: 'dispatch', email: 'dispatch@ecovent.com', password: 'dispatch@123', name: 'Dispatch Operator', role: 'DISPATCHER' },
  ]

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12)
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { email: u.email, name: u.name, passwordHash, active: true },
      create: {
        username: u.username,
        email: u.email,
        name: u.name,
        passwordHash,
        active: true,
      },
    })

    const role = await prisma.role.findUnique({ where: { code: u.role } })
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      })
    }
  }
}

export async function seedOrganization() {
  const deptMap = new Map<string, string>()
  for (const d of DEFAULT_DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, sortOrder: d.sortOrder, active: true },
      create: { code: d.code, name: d.name, sortOrder: d.sortOrder, active: true },
    })
    deptMap.set(d.code, dept.id)
  }

  const roleMap = new Map<string, string>()
  for (const r of DEFAULT_JOB_ROLES) {
    const role = await prisma.jobRole.upsert({
      where: { code: r.code },
      update: {
        label: r.label,
        sortOrder: r.sortOrder,
        active: true,
        departmentId: deptMap.get(r.departmentCode),
      },
      create: {
        code: r.code,
        label: r.label,
        sortOrder: r.sortOrder,
        active: true,
        departmentId: deptMap.get(r.departmentCode),
      },
    })
    roleMap.set(r.code, role.id)
  }

  for (const link of DEFAULT_STAGE_ROLE_MAP) {
    const jobRoleId = roleMap.get(link.jobRoleCode)
    if (!jobRoleId) continue
    const existing = await prisma.workflowStageRole.findFirst({
      where: { stageCode: link.stageCode, jobRoleId },
    })
    if (!existing) {
      await prisma.workflowStageRole.create({
        data: { stageCode: link.stageCode, jobRoleId },
      })
    }
  }

  const demoEmployees = [
    {
      name: 'Karthik S',
      email: 'sales@ecovent.com',
      departmentCode: 'COMMERCIAL',
      employeeCode: 'EMP-001',
      jobRoleCodes: ['SALES_EXEC', 'COMMERCIAL_PIC'],
    },
    {
      name: 'Priya N',
      email: 'design@ecovent.com',
      departmentCode: 'DESIGN',
      employeeCode: 'EMP-002',
      jobRoleCodes: ['DESIGN_ENGINEER', 'DESIGN_LEAD'],
    },
    {
      name: 'Ravi M',
      email: 'production@ecovent.com',
      departmentCode: 'PRODUCTION',
      employeeCode: 'EMP-003',
      jobRoleCodes: ['PRODUCTION_INCHARGE'],
    },
    {
      name: 'Suresh K',
      email: 'dispatch@ecovent.com',
      departmentCode: 'DISPATCH',
      employeeCode: 'EMP-004',
      jobRoleCodes: ['DISPATCHER'],
    },
  ]

  for (const e of demoEmployees) {
    const existing = await prisma.employee.findFirst({ where: { employeeCode: e.employeeCode } })
    const employee =
      existing ??
      (await prisma.employee.create({
        data: {
          name: e.name,
          email: e.email,
          employeeCode: e.employeeCode,
          departmentId: deptMap.get(e.departmentCode),
          active: true,
        },
      }))

    await prisma.employeeJobRole.deleteMany({ where: { employeeId: employee.id } })
    for (const [i, code] of e.jobRoleCodes.entries()) {
      const jobRoleId = roleMap.get(code)
      if (!jobRoleId) continue
      await prisma.employeeJobRole.create({
        data: { employeeId: employee.id, jobRoleId, isPrimary: i === 0 },
      })
    }
  }
}

export async function seedMasterLookups() {
  for (const item of DEFAULT_MASTER_LOOKUPS) {
    await prisma.masterLookup.upsert({
      where: { category_code: { category: item.category, code: item.code } },
      update: { label: item.label, sortOrder: item.sortOrder, active: true },
      create: { ...item, active: true },
    })
  }
}

async function seedCrmMasters() {
  const demoClients = [
    {
      code: 'ABC-CONSTRUCTION',
      name: 'ABC Construction Pvt Ltd',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      gstin: '29AABCU9603R1ZM',
      contacts: [
        { firstName: 'Rajesh', lastName: 'Kumar', designation: 'Project Manager', isPrimary: true },
        { firstName: 'Suresh', lastName: 'Rao', designation: 'Procurement Head' },
        { firstName: 'Anil', lastName: 'Kumar', designation: 'Site Engineer' },
        { firstName: 'Priya', lastName: 'Nair', designation: 'Finance Manager' },
      ],
      projects: [
        { code: 'P-001', name: 'Bangalore Mall', location: 'Bangalore' },
        { code: 'P-002', name: 'Chennai Airport', location: 'Chennai' },
        { code: 'P-003', name: 'Hyderabad Hospital', location: 'Hyderabad' },
      ],
    },
  ]

  for (const client of demoClients) {
    const customer = await prisma.customer.upsert({
      where: { code: client.code },
      update: { name: client.name, city: client.city, state: client.state, country: client.country, gstin: client.gstin },
      create: {
        code: client.code,
        name: client.name,
        city: client.city,
        state: client.state,
        country: client.country,
        gstin: client.gstin,
        active: true,
      },
    })

    const contactIds: Record<string, string> = {}
    for (const c of client.contacts) {
      const existing = await prisma.contact.findFirst({
        where: { customerId: customer.id, firstName: c.firstName, lastName: c.lastName ?? null },
      })
      const contact =
        existing ??
        (await prisma.contact.create({
          data: {
            customerId: customer.id,
            firstName: c.firstName,
            lastName: c.lastName,
            designation: c.designation,
            isPrimary: c.isPrimary ?? false,
            active: true,
          },
        }))
      contactIds[c.firstName] = contact.id
    }

    for (const p of client.projects) {
      const project = await prisma.project.upsert({
        where: { code: p.code },
        update: { name: p.name, location: p.location },
        create: {
          code: p.code,
          name: p.name,
          location: p.location,
          customerId: customer.id,
          status: 'ACTIVE',
        },
      })

      const links: Array<{ firstName: string; role: string; isPrimary?: boolean }> =
        p.code === 'P-001'
          ? [
              { firstName: 'Rajesh', role: 'CLIENT_PM', isPrimary: true },
              { firstName: 'Anil', role: 'SITE_ENGINEER' },
              { firstName: 'Suresh', role: 'PURCHASING' },
            ]
          : p.code === 'P-002'
            ? [
                { firstName: 'Rajesh', role: 'CLIENT_PM', isPrimary: true },
                { firstName: 'Priya', role: 'ACCOUNTS' },
              ]
            : [{ firstName: 'Anil', role: 'SITE_ENGINEER', isPrimary: true }]

      for (const link of links) {
        const contactId = contactIds[link.firstName]
        if (!contactId) continue
        await prisma.projectContact.upsert({
          where: {
            projectId_contactId_role: {
              projectId: project.id,
              contactId,
              role: link.role,
            },
          },
          update: { isPrimary: link.isPrimary ?? false, isActive: true },
          create: {
            projectId: project.id,
            contactId,
            role: link.role,
            isPrimary: link.isPrimary ?? false,
            isActive: true,
          },
        })
      }
    }
  }
}

async function seedOrdersFromJson() {
  const ordersPath = join(__dirname, '../../src/data/orders.json')
  const orders = JSON.parse(readFileSync(ordersPath, 'utf-8')) as Array<{
    orderNo: string
    customerName: string
    productionDate: string
    totalQuantity: number
    totalArea: number
    status: string
    revision: number
    createdAt: string
    items: Array<{
      tagNo: number
      description: string
      w1: number
      h1: number
      w2: number
      h2: number
      length: number
      orderedQty: number
      area: number
      producedQty: number
      readyQty: number
      dispatchedQty: number
    }>
  }>

  const customerMap = new Map<string, string>()

  for (const order of orders) {
    let customerId = customerMap.get(order.customerName)
    if (!customerId) {
      const code = order.customerName.replace(/\s+/g, '-').toUpperCase().slice(0, 20)
      const customer = await prisma.customer.upsert({
        where: { code },
        update: { name: order.customerName },
        create: { code, name: order.customerName, active: true },
      })
      customerId = customer.id
      customerMap.set(order.customerName, customerId)
    }

    const projectCode = `PRJ-${order.orderNo.split('-')[0]}`
    const project = await prisma.project.upsert({
      where: { code: projectCode },
      update: { name: order.orderNo },
      create: {
        code: projectCode,
        name: order.orderNo,
        customerId,
        status: 'ACTIVE',
      },
    })

    await prisma.customerOrder.upsert({
      where: { orderNo: order.orderNo },
      update: {
        status: mapOrderStatus(order.status),
        totalQuantity: order.totalQuantity,
        totalArea: order.totalArea,
        productionDate: new Date(order.productionDate),
      },
      create: {
        orderNo: order.orderNo,
        customerId,
        projectId: project.id,
        productionDate: new Date(order.productionDate),
        totalQuantity: order.totalQuantity,
        totalArea: order.totalArea,
        status: mapOrderStatus(order.status),
        revision: order.revision,
        createdAt: new Date(order.createdAt),
        items: {
          create: order.items.map((item) => ({
            tagNo: String(item.tagNo),
            description: item.description,
            w1: item.w1,
            h1: item.h1,
            w2: item.w2,
            h2: item.h2,
            length: item.length,
            orderedQty: item.orderedQty,
            area: item.area,
            producedQty: item.producedQty,
            readyQty: item.readyQty,
            dispatchedQty: item.dispatchedQty,
          })),
        },
      },
    })
  }
}

function mapDesignStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'PENDING',
    in_review: 'IN_REVIEW',
    approved: 'APPROVED',
    revision_needed: 'REVISION_NEEDED',
  }
  return map[status] ?? 'PENDING'
}

async function seedEnquiriesFromJson() {
  const enquiriesPath = join(__dirname, '../../src/data/enquiries.json')
  const enquiries = JSON.parse(readFileSync(enquiriesPath, 'utf-8')) as Array<{
    enquiryNo: string
    customerName: string
    contactPerson?: string
    phone?: string
    email?: string
    projectName: string
    location?: string
    enquiryDate: string
    expectedCompletion?: string
    salesPerson?: string
    priority: string
    source?: string
    remarks?: string
    drawingFile?: string
    orderId?: string
    designReview: {
      status: string
      revision?: number
      reviewedBy?: string
      reviewDate?: string
      ductTags?: number
      totalQty?: number
      totalArea?: number
      notes?: string
    }
    activity?: Array<{
      timestamp: string
      phase: string
      title: string
      detail?: string
      actor: string
      actorRole?: string
      revision?: number
    }>
    createdAt: string
  }>

  for (const enq of enquiries) {
    const code = enq.customerName.replace(/\s+/g, '-').toUpperCase().slice(0, 20)
    const customer = await prisma.customer.upsert({
      where: { code },
      update: { name: enq.customerName },
      create: { code, name: enq.customerName, active: true },
    })

    let customerOrderId: string | undefined
    if (enq.orderId || enq.projectName) {
      const order = await prisma.customerOrder.findFirst({
        where: { orderNo: enq.projectName },
      })
      customerOrderId = order?.id
    }

    const dr = enq.designReview
    const enquiry = await prisma.enquiry.upsert({
      where: { enquiryNo: enq.enquiryNo },
      update: {
        customerId: customer.id,
        customerOrderId,
        contactPerson: enq.contactPerson,
        phone: enq.phone,
        email: enq.email,
        projectName: enq.projectName,
        projectLocation: enq.location,
        salesPerson: enq.salesPerson,
        priority: enq.priority.toUpperCase(),
        source: enq.source,
        remarks: enq.remarks,
        drawingFileName: enq.drawingFile,
        designStatus: mapDesignStatus(dr.status),
        designRevision: dr.revision ?? 1,
        designReviewedBy: dr.reviewedBy,
        designReviewDate: dr.reviewDate ? new Date(dr.reviewDate) : null,
        ductTags: dr.ductTags,
        ductTotalQty: dr.totalQty,
        ductTotalArea: dr.totalArea,
        designNotes: dr.notes,
        status: customerOrderId ? 'CONVERTED' : 'NEW',
      },
      create: {
        enquiryNo: enq.enquiryNo,
        customerId: customer.id,
        customerOrderId,
        contactPerson: enq.contactPerson,
        phone: enq.phone,
        email: enq.email,
        projectName: enq.projectName,
        projectLocation: enq.location,
        enquiryDate: new Date(enq.enquiryDate),
        expectedCompletion: enq.expectedCompletion ? new Date(enq.expectedCompletion) : null,
        salesPerson: enq.salesPerson,
        priority: enq.priority.toUpperCase(),
        source: enq.source,
        remarks: enq.remarks,
        drawingFileName: enq.drawingFile,
        designStatus: mapDesignStatus(dr.status),
        designRevision: dr.revision ?? 1,
        designReviewedBy: dr.reviewedBy,
        designReviewDate: dr.reviewDate ? new Date(dr.reviewDate) : null,
        ductTags: dr.ductTags,
        ductTotalQty: dr.totalQty,
        ductTotalArea: dr.totalArea,
        designNotes: dr.notes,
        status: customerOrderId ? 'CONVERTED' : 'NEW',
        createdAt: new Date(enq.createdAt),
      },
    })

    if (enq.activity?.length) {
      await prisma.enquiryActivity.deleteMany({ where: { enquiryId: enquiry.id } })
      await prisma.enquiryActivity.createMany({
        data: enq.activity.map((a) => ({
          enquiryId: enquiry.id,
          timestamp: new Date(a.timestamp),
          phase: a.phase,
          title: a.title,
          detail: a.detail,
          actor: a.actor,
          actorRole: a.actorRole,
          revision: a.revision,
        })),
      })
    }

    if (customerOrderId && enq.enquiryNo === 'ENQ-2026-0001') {
      await prisma.customerOrder.update({
        where: { id: customerOrderId },
        data: {
          productionApproved: true,
          productionApprovedBy: 'Ravi M',
          productionApprovedDate: new Date('2026-09-03'),
        },
      })
    }
  }
}

async function linkPortalUsersToEmployees() {
  const pairs = [
    { username: 'designer', employeeCode: 'EMP-002' },
    { username: 'production', employeeCode: 'EMP-003' },
    { username: 'dispatch', employeeCode: 'EMP-004' },
  ]
  for (const { username, employeeCode } of pairs) {
    const user = await prisma.user.findUnique({ where: { username } })
    const employee = await prisma.employee.findFirst({ where: { employeeCode } })
    if (!user || !employee) continue
    await prisma.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
    })
  }
}

async function backfillDesignAssigneesFromActivity() {
  const priya = await prisma.employee.findFirst({ where: { employeeCode: 'EMP-002' } })
  if (!priya) return

  const enquiries = await prisma.enquiry.findMany({
    where: { customerOrderId: null },
    include: { activities: true },
  })

  for (const enq of enquiries) {
    const workedDesign = enq.activities.some((a) => a.phase === 'design' && a.actor === priya.name)
    const reviewedByPriya = enq.designReviewedBy === priya.name
    if (!workedDesign && !reviewedByPriya) continue
    if (enq.designStatus === 'PENDING') continue

    await prisma.enquiry.update({
      where: { id: enq.id },
      data: {
        currentAssigneeId: priya.id,
        currentAssigneeRoleCode: 'DESIGN_ENGINEER',
        ...(enq.status === 'NEW' ? { status: 'DESIGN_REVIEW' } : {}),
      },
    })
  }
}

export async function seedDatabase() {
  console.log('Seeding roles and permissions...')
  await seedRolesAndPermissions()

  console.log('Seeding users...')
  await seedUsers()

  console.log('Seeding organization (departments, roles, employees)...')
  await seedOrganization()

  console.log('Seeding master lookups...')
  await seedMasterLookups()

  if (shouldSeedDemoBusinessData()) {
    console.log('Seeding CRM clients, contacts, and projects...')
    await seedCrmMasters()

    console.log('Seeding customer orders from orders.json...')
    await seedOrdersFromJson()

    const enquiriesPath = join(__dirname, '../../src/data/enquiries.json')
    const enquirySeed = JSON.parse(readFileSync(enquiriesPath, 'utf-8')) as unknown[]
    if (enquirySeed.length > 0) {
      console.log('Seeding enquiries from enquiries.json...')
      await seedEnquiriesFromJson()
    } else {
      console.log('Skipping enquiry seed (enquiries.json is empty).')
    }

    console.log('Backfilling design assignees on seeded enquiries...')
    await backfillDesignAssigneesFromActivity()
  } else {
    console.log(
      'Skipping demo CRM, orders, and enquiries (set SEED_DEMO_DATA=true to load sample clients).',
    )
  }

  console.log('Linking portal logins to employees...')
  await linkPortalUsersToEmployees()

  console.log('Seed complete.')
  console.log('  admin / admin@123')
  console.log('  supervisor / supervisor@123')
  console.log('  designer / designer@123')
  console.log('  accounts / accounts@123')
  console.log('  production / production@123')
  console.log('  dispatch / dispatch@123')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  seedDatabase()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
