/**
 * One-off: mark attended enquiries (client input present) as INTAKE_COMPLETE.
 *
 *   npm run db:backfill-enquiry-intake          # dry run
 *   npm run db:backfill-enquiry-intake -- --apply
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const apply = process.argv.includes('--apply')
  const enquiries = await prisma.enquiry.findMany({
    where: { status: 'NEW', designStatus: 'PENDING' },
    include: {
      documents: true,
      activities: true,
    },
  })

  const toUpdate = enquiries.filter((e) => {
    const hasDrawing = Boolean(e.drawingFileName?.trim())
    const hasInputDoc = e.documents.some((d) => d.category !== 'duct_schedule')
    const hasInputActivity = e.activities.some(
      (a) => a.phase === 'design' && /client input|input files/i.test(a.title),
    )
    return hasDrawing || hasInputDoc || hasInputActivity
  })

  console.log(`Candidates: ${toUpdate.length}`)
  for (const e of toUpdate) {
    console.log(`  ${e.enquiryNo} (${e.id})`)
  }

  if (!apply || !toUpdate.length) {
    if (!apply && toUpdate.length) console.log('\nDry run. Pass --apply to update.')
    return
  }

  await prisma.enquiry.updateMany({
    where: { id: { in: toUpdate.map((e) => e.id) } },
    data: { status: 'INTAKE_COMPLETE' },
  })
  console.log('Updated.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
