import type { FastifyRequest } from 'fastify'

export interface ActivityActor {
  name: string
  role: string
}

const NAME_HEADER = 'x-operation-actor-name'
const ROLE_HEADER = 'x-operation-actor-role'

/** Demo / ops UI: optional headers override JWT user for activity log attribution. */
export function attachOperationActor(request: FastifyRequest): void {
  const auth = request.authUser
  if (!auth) return

  const rawName = request.headers[NAME_HEADER]
  const rawRole = request.headers[ROLE_HEADER]
  const name = typeof rawName === 'string' ? rawName.trim().slice(0, 120) : ''
  if (!name) return

  const role =
    typeof rawRole === 'string' && rawRole.trim()
      ? rawRole.trim().slice(0, 80)
      : auth.roles[0] ?? 'User'

  request.activityActor = { name, role }
}

export function activityActorFromRequest(request: FastifyRequest): ActivityActor {
  if (request.activityActor) return request.activityActor
  const user = request.authUser!
  const role = user.roles.length > 0 ? user.roles.join(', ') : 'User'
  return { name: user.name, role }
}
