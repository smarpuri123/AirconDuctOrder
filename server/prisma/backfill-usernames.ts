/**
 * Run once after adding the username column to existing databases:
 *   npx tsx prisma/backfill-usernames.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  for (const user of users) {
    const local = user.email.split('@')[0]?.toLowerCase()
    if (!local) continue
    if (user.username === local) continue
    await prisma.user.update({
      where: { id: user.id },
      data: { username: local },
    })
    console.log(`username ${local} ← ${user.email}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
