import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateUser, getUserById } from '../services/auth.service.js'

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(6),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await authenticateUser(body.username, body.password)

    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = app.jwt.sign(user)
    return { token, user }
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const authUser = request.authUser!
    const user = await getUserById(authUser.id)
    if (!user) {
      return reply.code(401).send({ error: 'User not found' })
    }
    return { user }
  })
}
