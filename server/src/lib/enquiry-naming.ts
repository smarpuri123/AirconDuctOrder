import type { Prisma } from '@prisma/client'
import { allocateSequence, ensureSequenceAtLeast } from './business-sequence.js'

/** Fallback when CRM master has no explicit client code. */
export function normalizeCustomerCode(code: string | null | undefined, customerName: string): string {
  const trimmed = code?.trim()
  if (trimmed) return trimmed
  return customerName.replace(/\s+/g, '-').toUpperCase().slice(0, 20)
}

export function enquiryNoPrefix(customerCode: string, projectCode: string): string {
  return `${customerCode}-${projectCode}-`
}

export function formatEnquiryNo(customerCode: string, projectCode: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error('Enquiry sequence must be an integer from 1 to 9999')
  }
  const prefix = enquiryNoPrefix(customerCode, projectCode)
  return `${prefix}${String(sequence).padStart(4, '0')}`
}

/** Highest 4-digit numeric suffix already used under this prefix. */
export function maxEnquirySequenceFromNumbers(enquiryNos: string[], prefix: string): number {
  let max = 0
  for (const enquiryNo of enquiryNos) {
    if (!enquiryNo.startsWith(prefix)) continue
    const suffix = enquiryNo.slice(prefix.length)
    if (!/^\d{4}$/.test(suffix)) continue
    max = Math.max(max, parseInt(suffix, 10))
  }
  return max
}

type AllocateEnquiryNoParams = {
  customerId: string
  projectId: string
  customerCode: string
  projectCode: string
}

function enquirySequenceScope(customerId: string, projectId: string): string {
  return `enquiry:${customerId}:${projectId}`
}

/** Next enquiry number for one client + project (sequence resets per pair). */
export async function allocateNextEnquiryNo(
  tx: Prisma.TransactionClient,
  params: AllocateEnquiryNoParams,
): Promise<string> {
  const prefix = enquiryNoPrefix(params.customerCode, params.projectCode)
  const scope = enquirySequenceScope(params.customerId, params.projectId)
  const rows = await tx.enquiry.findMany({
    where: {
      customerId: params.customerId,
      projectId: params.projectId,
      enquiryNo: { startsWith: prefix },
    },
    select: { enquiryNo: true },
  })
  const lastUsed = maxEnquirySequenceFromNumbers(rows.map((r) => r.enquiryNo), prefix)
  await ensureSequenceAtLeast(tx, scope, lastUsed)
  const next = await allocateSequence(tx, scope)
  return formatEnquiryNo(params.customerCode, params.projectCode, next)
}
