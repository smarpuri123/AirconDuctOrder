import { PrismaClient } from '@prisma/client'
import { rm } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const prisma = new PrismaClient()
const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOAD_ROOT = join(__dirname, '../uploads/enquiries')

/** Legacy demo numbers: ENQ-2026-0001, etc. Production numbers use CLIENT-PROJECT-0001. */
const LEGACY_PREFIX = 'ENQ-'

export async function clearLegacyEnquiries(): Promise<number> {
  const legacy = await prisma.enquiry.findMany({
    where: { enquiryNo: { startsWith: LEGACY_PREFIX } },
    select: { id: true, enquiryNo: true },
  })

  if (legacy.length === 0) {
    console.log('No legacy ENQ-* enquiries found.')
    return 0
  }

  console.log('Removing legacy enquiries:')
  for (const row of legacy) {
    console.log(`  - ${row.enquiryNo} (${row.id})`)
    await rm(join(UPLOAD_ROOT, row.id), { recursive: true, force: true })
  }

  const deleted = await prisma.enquiry.deleteMany({
    where: { enquiryNo: { startsWith: LEGACY_PREFIX } },
  })

  const seq = await prisma.$executeRaw`
    DELETE FROM business_sequences WHERE scope LIKE 'enquiry:%'
  `
  console.log(`Deleted ${deleted.count} enquiry row(s). Reset ${seq} per-project sequence row(s).`)
  return deleted.count
}

async function main() {
  await clearLegacyEnquiries()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
