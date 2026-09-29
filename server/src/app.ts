import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config.js'
import { registerAuth } from './plugins/auth.js'
import { authRoutes } from './routes/auth.routes.js'
import { customerRoutes } from './routes/customers.routes.js'
import { enquiryRoutes } from './routes/enquiries.routes.js'
import { customerOrderRoutes } from './routes/customer-orders.routes.js'
import { dispatchRoutes } from './routes/dispatches.routes.js'
import { projectRoutes } from './routes/projects.routes.js'
import { masterRoutes } from './routes/masters.routes.js'
import { orgRoutes } from './routes/org.routes.js'
import { notificationRoutes } from './routes/notifications.routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: config.nodeEnv !== 'test',
    bodyLimit: 50 * 1024 * 1024,
  })

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Operation-Actor-Name', 'X-Operation-Actor-Role'],
  })

  await registerAuth(app)

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error && typeof error === 'object' && 'validation' in error) {
      return reply.code(400).send({ error: 'Validation error', details: (error as { validation: unknown }).validation })
    }
    app.log.error(error)
    return reply.code(500).send({ error: 'Internal server error' })
  })

  app.get('/api/health', async () => ({ status: 'ok', service: 'ecovent-api' }))

  await app.register(async (api) => {
    await api.register(authRoutes)
    await api.register(customerRoutes)
    await api.register(projectRoutes)
    await api.register(masterRoutes)
    await api.register(orgRoutes)
    await api.register(enquiryRoutes)
    await api.register(customerOrderRoutes)
    await api.register(dispatchRoutes)
    await api.register(notificationRoutes)
  }, { prefix: '/api' })

  return app
}
