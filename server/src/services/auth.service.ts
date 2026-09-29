import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import type { AuthUser } from '../types/fastify.js'
import type { PermissionCode } from '../lib/permissions.js'
import { normalizeUsername } from '../lib/username.js'

async function findUserForLogin(loginId: string) {
  const trimmed = loginId.trim()
  const normalizedUsername = normalizeUsername(trimmed)

  const byUsername = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    include: userWithRolesInclude,
  })
  if (byUsername) return byUsername

  if (trimmed.includes('@')) {
    return prisma.user.findUnique({
      where: { email: trimmed.toLowerCase() },
      include: userWithRolesInclude,
    })
  }

  return null
}

const userWithRolesInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} as const

export async function authenticateUser(username: string, password: string): Promise<AuthUser | null> {
  const user = await findUserForLogin(username)
  if (!user || !user.active) return null

  const valid = await bcrypt.compare(password.trim(), user.passwordHash)
  if (!valid) return null

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  return toAuthUser(user)
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  })
  if (!user || !user.active) return null
  return toAuthUser(user)
}

function toAuthUser(user: {
  id: string
  username: string
  email: string
  name: string
  roles: Array<{
    role: {
      code: string
      permissions: Array<{ permission: { code: string } }>
    }
  }>
}): AuthUser {
  const roles = user.roles.map((r) => r.role.code)
  const permissions = [
    ...new Set(
      user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)),
    ),
  ] as PermissionCode[]

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    roles,
    permissions,
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}
