import { prisma } from './prisma.js'
import type { PermissionCode } from './permissions.js'
import { PERMISSIONS } from './permissions.js'

export async function getUserIdsWithAnyPermission(
  permissions: PermissionCode[],
  options?: { excludeUserIds?: string[] },
): Promise<string[]> {
  const exclude = new Set(options?.excludeUserIds ?? [])
  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      roles: {
        select: {
          role: {
            select: {
              code: true,
              name: true,
              permissions: {
                select: { permission: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
  })

  const needed = new Set(permissions)
  const ids: string[] = []

  for (const user of users) {
    if (exclude.has(user.id)) continue
    const codes = new Set<string>()
    let isAdmin = false
    for (const ur of user.roles) {
      if (ur.role.code === 'ADMIN') isAdmin = true
      for (const rp of ur.role.permissions) {
        codes.add(rp.permission.code)
      }
    }
    if (isAdmin || permissions.some((p) => codes.has(p))) {
      ids.push(user.id)
    }
  }

  return ids
}

export async function getDispatchNotificationRecipients(excludeUserId?: string): Promise<string[]> {
  return getUserIdsWithAnyPermission(
    [PERMISSIONS.DISPATCHES_READ, PERMISSIONS.DISPATCHES_WRITE],
    { excludeUserIds: excludeUserId ? [excludeUserId] : undefined },
  )
}
