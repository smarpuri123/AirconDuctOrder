import type { PermissionCode } from '../lib/permissions.js'
import type { ActivityActor } from '../lib/operation-actor.js'

export interface AuthUser {
  id: string
  username: string
  email: string
  name: string
  roles: string[]
  permissions: PermissionCode[]
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser
    user: AuthUser
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser
    activityActor?: ActivityActor
  }
}
