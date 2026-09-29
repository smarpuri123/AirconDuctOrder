/**
 * One-off: renumber legacy ENQ-YYYY-#### enquiries to {CustomerCode}-{ProjectCode}-####.
 *
 * Usage:
 *   npm run db:migrate-enquiry-numbers          # dry run (no writes)
 *   npm run db:migrate-enquiry-numbers -- --apply
 */
import { PrismaClient } from '@prisma/client'
import {
  enquiryNoPrefix,
  formatEnquiryNo,
  maxEnquirySequenceFromNumbers,
  normalizeCustomerCode,
} from '../src/lib/enquiry-naming.js'
import { formatCustomerOrderNo } from '../src/lib/order-naming.js'

const prisma = new PrismaClient()

const LEGACY_ENQUIRY_NO = /^ENQ-\d{4}-\d{4}$/i

function isLegacyEnquiryNo(enquiryNo: string): boolean {
  return LEGACY_ENQUIRY_NO.test(enquiryNo.trim())
}

function fallbackProjectCode(projectName: string): string {
  return `PRJ-${projectName.replace(/\s+/g, '-').toUpperCase().slice(0, 16)}`
}

type PlannedChange = {
  enquiryId: string
  oldEnquiryNo: string
  newEnquiryNo: string
  projectName: string
  customerOrderId: string | null
}

function planRenumber(
  rows: Array<{
    id: string
    enquiryNo: string
    customerId: string
    projectId: string | null
    projectName: string
    customerOrderId: string | null
    createdAt: Date
    customer: { code: string | null; name: string }
    project: { code: string } | null
  }>,
): { changes: PlannedChange[]; skipped: Array<{ id: string; enquiryNo: string; reason: string }> } {
  const legacy = rows.filter((r) => isLegacyEnquiryNo(r.enquiryNo))
  if (!legacy.length) return { changes: [], skipped: [] }

  const legacyIds = new Set(legacy.map((r) => r.id))
  const usedGlobal = new Set(
    rows.filter((r) => !legacyIds.has(r.id)).map((r) => r.enquiryNo),
  )

  const groupKey = (r: { customerId: string; projectId: string | null }) =>
    `${r.customerId}::${r.projectId ?? ''}`

  const byGroup = new Map<string, typeof legacy>()
  for (const row of legacy) {
    const key = groupKey(row)
    const list = byGroup.get(key) ?? []
    list.push(row)
    byGroup.set(key, list)
  }

  const changes: PlannedChange[] = []
  const skipped: Array<{ id: string; enquiryNo: string; reason: string }> = []

  for (const [, group] of byGroup) {
    const sample = group[0]
    const customerCode = normalizeCustomerCode(sample.customer.code, sample.customer.name)
    const projectCode =
      sample.project?.code ?? fallbackProjectCode(sample.projectName)
    const prefix = enquiryNoPrefix(customerCode, projectCode)

    const sorted = [...group].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )

    for (const row of sorted) {
      const max = maxEnquirySequenceFromNumbers([...usedGlobal], prefix)
      let seq = max + 1
      let newEnquiryNo = formatEnquiryNo(customerCode, projectCode, seq)
      while (usedGlobal.has(newEnquiryNo)) {
        seq += 1
        if (seq > 9999) {
          skipped.push({
            id: row.id,
            enquiryNo: row.enquiryNo,
            reason: `No free sequence under ${prefix}`,
          })
          break
        }
        newEnquiryNo = formatEnquiryNo(customerCode, projectCode, seq)
      }
      if (seq > 9999) continue

      usedGlobal.add(newEnquiryNo)
      changes.push({
        enquiryId: row.id,
        oldEnquiryNo: row.enquiryNo,
        newEnquiryNo,
        projectName: row.projectName,
        customerOrderId: row.customerOrderId,
      })
    }
  }

  return { changes, skipped }
}

async function applyChanges(changes: PlannedChange[]): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const tempPrefix = `__MIGRATE__${Date.now()}__`

      for (const change of changes) {
        await tx.enquiry.update({
          where: { id: change.enquiryId },
          data: { enquiryNo: `${tempPrefix}${change.enquiryId}` },
        })
      }

      for (const change of changes) {
        await tx.enquiry.update({
          where: { id: change.enquiryId },
          data: { enquiryNo: change.newEnquiryNo },
        })

        const oldOrderTitle = formatCustomerOrderNo(change.projectName, change.oldEnquiryNo)
        const newOrderTitle = formatCustomerOrderNo(change.projectName, change.newEnquiryNo)

        if (change.customerOrderId) {
          const order = await tx.customerOrder.findUnique({
            where: { id: change.customerOrderId },
          })
          if (order?.orderNo === oldOrderTitle) {
            await tx.customerOrder.update({
              where: { id: change.customerOrderId },
              data: { orderNo: newOrderTitle },
            })
          }
        }

        const activities = await tx.enquiryActivity.findMany({
          where: {
            enquiryId: change.enquiryId,
            detail: { contains: change.oldEnquiryNo },
          },
          select: { id: true, detail: true },
        })
        for (const activity of activities) {
          if (!activity.detail) continue
          await tx.enquiryActivity.update({
            where: { id: activity.id },
            data: {
              detail: activity.detail.replaceAll(change.oldEnquiryNo, change.newEnquiryNo),
            },
          })
        }
      }
    },
    { timeout: 120_000 },
  )
}

async function main() {
  const apply = process.argv.includes('--apply')

  const rows = await prisma.enquiry.findMany({
    include: {
      customer: { select: { code: true, name: true } },
      project: { select: { code: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const legacyCount = rows.filter((r) => isLegacyEnquiryNo(r.enquiryNo)).length
  console.log(`Enquiries in database: ${rows.length}`)
  console.log(`Legacy (ENQ-YYYY-####): ${legacyCount}`)

  const { changes, skipped } = planRenumber(rows)

  if (skipped.length) {
    console.warn('\nSkipped:')
    for (const s of skipped) {
      console.warn(`  ${s.enquiryNo} (${s.id}): ${s.reason}`)
    }
  }

  if (!changes.length) {
    console.log('\nNothing to migrate.')
    return
  }

  console.log(`\nPlanned renumber (${changes.length}):`)
  for (const c of changes) {
    console.log(`  ${c.oldEnquiryNo} → ${c.newEnquiryNo}`)
  }

  if (!apply) {
    console.log('\nDry run only. Pass --apply to write changes.')
    return
  }

  console.log('\nApplying...')
  await applyChanges(changes)
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
