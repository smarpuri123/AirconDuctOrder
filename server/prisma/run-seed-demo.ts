process.env.SEED_DEMO_DATA = 'true'
import { prisma, seedDatabase } from './seed.js'

seedDatabase()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
