import { prisma } from '../lib/prisma.js'
import { normalizeUsername } from '../lib/username.js'
import { hashPassword } from './auth.service.js'
import {
  ASSIGNABLE_PORTAL_ROLES,
  PORTAL_ROLE_TO_JOB_ROLE,
  STAGE_PORTAL_ROLES,
} from '../lib/portal-role-job-map.js'

const userListInclude = {
  roles: { include: { role: true } },
  employee: { select: { id: true } },
} as const

export type PortalUserDto = {
  id: string
  username: string
  email: string
  name: string
  phone: string | null
  active: boolean
  roles: string[]
  employeeId: string | null
  lastLoginAt: string | null
  createdAt: string
}

function mapUser(user: {
  id: string
  username: string
  email: string
  name: string
  phone: string | null
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
  roles: Array<{ role: { code: string } }>
  employee: { id: string } | null
}): PortalUserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    phone: user.phone,
    active: user.active,
    roles: user.roles.map((r) => r.role.code),
    employeeId: user.employee?.id ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function listPortalUsers(): Promise<PortalUserDto[]> {
  const users = await prisma.user.findMany({
    include: userListInclude,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })
  return users.map(mapUser)
}

export type CreatePortalUserInput = {
  username: string
  name: string
  password: string
  phone?: string
  email?: string
  roleCode: string
}

export async function createPortalUser(input: CreatePortalUserInput): Promise<PortalUserDto> {
  const username = normalizeUsername(input.username)
  if (!username) throw new Error('Username is required')

  const roleCode = input.roleCode.toUpperCase()
  if (!ASSIGNABLE_PORTAL_ROLES.includes(roleCode as typeof ASSIGNABLE_PORTAL_ROLES[number])) {
    throw new Error('Invalid role')
  }

  const role = await prisma.role.findUnique({ where: { code: roleCode } })
  if (!role) throw new Error('Role not configured — run database seed')

  const email =
    input.email?.trim().toLowerCase() ||
    `${username}@users.ecovent.local`

  const existingUsername = await prisma.user.findUnique({ where: { username } })
  if (existingUsername) throw new Error('Username already exists')

  const existingEmail = await prisma.user.findUnique({ where: { email } })
  if (existingEmail) throw new Error('Email already in use')

  const passwordHash = await hashPassword(input.password)
  const jobRoleCode = PORTAL_ROLE_TO_JOB_ROLE[roleCode]
  const jobRole = jobRoleCode
    ? await prisma.jobRole.findUnique({ where: { code: jobRoleCode } })
    : null

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username,
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        passwordHash,
        active: true,
      },
    })

    await tx.userRole.create({
      data: { userId: created.id, roleId: role.id },
    })

    const employee = await tx.employee.create({
      data: {
        userId: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        departmentId: jobRole?.departmentId ?? null,
        active: true,
      },
    })

    if (jobRole) {
      await tx.employeeJobRole.create({
        data: { employeeId: employee.id, jobRoleId: jobRole.id, isPrimary: true },
      })
    }

    return tx.user.findUnique({
      where: { id: created.id },
      include: userListInclude,
    })
  })

  if (!user) throw new Error('Failed to create user')
  return mapUser(user)
}

export async function updatePortalUser(
  id: string,
  input: { name?: string; phone?: string; active?: boolean },
): Promise<PortalUserDto | null> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    include: userListInclude,
  })

  if (input.name !== undefined || input.phone !== undefined) {
    await prisma.employee.updateMany({
      where: { userId: id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    })
  }

  return mapUser(user)
}

export async function resetPortalUserPassword(id: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password)
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  })
}

export type AssignablePortalUser = {
  userId: string
  employeeId: string
  name: string
  username: string
  phone: string | null
  roles: string[]
}

type UserWithEmployee = {
  id: string
  username: string
  name: string
  phone: string | null
  roles: Array<{ role: { code: string } }>
  employee: { id: string } | null
}

function mapAssignable(user: UserWithEmployee): AssignablePortalUser | null {
  if (!user.employee?.id) return null
  return {
    userId: user.id,
    employeeId: user.employee.id,
    name: user.name,
    username: user.username,
    phone: user.phone,
    roles: user.roles.map((r) => r.role.code),
  }
}

async function loadActiveUsersWithEmployee(): Promise<UserWithEmployee[]> {
  return prisma.user.findMany({
    where: { active: true, employee: { isNot: null } },
    include: {
      roles: { include: { role: true } },
      employee: { select: { id: true } },
    },
    orderBy: { name: 'asc' },
  })
}

/** All active portal users (Settings) with a linked employee — for enquiry responsibility. */
export async function listAllAssignablePortalUsers(): Promise<AssignablePortalUser[]> {
  const users = await loadActiveUsersWithEmployee()
  return users.map(mapAssignable).filter((u): u is AssignablePortalUser => u !== null)
}

/** Portal users whose role matches the workflow stage. */
export async function listAssignablePortalUsersForStage(
  stageCode: string,
): Promise<AssignablePortalUser[]> {
  const allowed = STAGE_PORTAL_ROLES[stageCode]
  if (!allowed) return []
  const users = await loadActiveUsersWithEmployee()
  return users
    .filter((u) => u.roles.some((r) => allowed.includes(r.role.code)))
    .map(mapAssignable)
    .filter((u): u is AssignablePortalUser => u !== null)
}

/** Keep legacy employee rows aligned with Settings portal user names. */
export async function syncEmployeeNamesFromPortalUsers(): Promise<number> {
  const employees = await prisma.employee.findMany({
    where: { userId: { not: null } },
    include: { user: { select: { name: true, email: true, phone: true } } },
  })
  let updated = 0
  for (const employee of employees) {
    const user = employee.user
    if (!user) continue
    const name = user.name.trim()
    const email = user.email
    const phone = user.phone
    if (employee.name === name && employee.email === email && employee.phone === phone) continue
    await prisma.employee.update({
      where: { id: employee.id },
      data: { name, email, phone },
    })
    updated += 1
  }
  return updated
}
