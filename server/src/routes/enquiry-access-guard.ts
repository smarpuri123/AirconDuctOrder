import type { FastifyReply, FastifyRequest } from 'fastify'
import { canAccessEnquiryForUser } from '../lib/enquiry-access.js'

export async function guardEnquiryAssignedToUser(
  request: FastifyRequest,
  reply: FastifyReply,
  enquiryId: string,
): Promise<boolean> {
  const user = request.authUser
  if (!user) {
    await reply.code(401).send({ error: 'Unauthorized' })
    return false
  }
  const allowed = await canAccessEnquiryForUser(user, enquiryId)
  if (!allowed) {
    await reply.code(403).send({
      error: 'Forbidden',
      message: 'This enquiry is not assigned to you',
    })
    return false
  }
  return true
}
