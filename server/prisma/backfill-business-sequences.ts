/**
 * One-time alignment of business_sequences with existing enquiry/dispatch numbers.
 * Safe to run multiple times (uses GREATEST).
 */
import { PrismaClient } from '@prisma/client'
import { maxEnquirySequenceFromNumbers, enquiryNoPrefix } from '../src/lib/enquiry-naming.js'
import { maxDispatchSequenceFromNumbers } from '../src/lib/business-sequence.js'

const prisma = new PrismaClient()

async function ensureAtLeast(scope: string, minLastUsed: number) {
  const floor = Math.max(0, minLastUsed)
  await prisma.$executeRaw`
    INSERT INTO business_sequences (scope, next_value, updated_at)
    VALUES (${scope}, ${floor}, NOW())
    ON CONFLICT (scope) DO UPDATE
    SET next_value = GREATEST(business_sequences.next_value, ${floor}),
        updated_at = NOW()
  `
}

async function main() {
  const enquiries = await prisma.enquiry.findMany({
    select: { customerId: true, projectId: true, enquiryNo: true, customer: { select: { code: true, name: true } }, project: { select: { code: true } } },
  })

  const enquiryGroups = new Map<string, { prefix: string; nos: string[] }>()
  for (const e of enquiries) {
    if (!e.projectId || !e.project) continue
    const customerCode = (e.customer.code ?? e.customer.name).trim()
    const prefix = enquiryNoPrefix(customerCode, e.project.code)
    const scope = `enquiry:${e.customerId}:${e.projectId}`
    const group = enquiryGroups.get(scope) ?? { prefix, nos: [] }
    group.nos.push(e.enquiryNo)
    enquiryGroups.set(scope, group)
  }

  for (const [scope, group] of enquiryGroups) {
    const last = maxEnquirySequenceFromNumbers(group.nos, group.prefix)
    await ensureAtLeast(scope, last)
    console.log(`enquiry scope ${scope} -> last used ${last}`)
  }

  const dispatches = await prisma.dispatch.findMany({ select: { dispatchNo: true } })
  const byYear = new Map<number, string[]>()
  for (const d of dispatches) {
    const m = d.dispatchNo.match(/^D-(\d{4})-/)
    if (!m) continue
    const year = parseInt(m[1], 10)
    const list = byYear.get(year) ?? []
    list.push(d.dispatchNo)
    byYear.set(year, list)
  }

  for (const [year, nos] of byYear) {
    const scope = `dispatch:${year}`
    const last = maxDispatchSequenceFromNumbers(nos, year)
    await ensureAtLeast(scope, last)
    console.log(`dispatch scope ${scope} -> last used ${last}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
