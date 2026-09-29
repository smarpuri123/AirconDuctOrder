import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/** Ensures the counter is at least `minLastUsed` (last allocated sequence value). */
export async function ensureSequenceAtLeast(tx: Tx, scope: string, minLastUsed: number): Promise<void> {
  const floor = Math.max(0, minLastUsed)
  await tx.$executeRaw`
    INSERT INTO business_sequences (scope, next_value, updated_at)
    VALUES (${scope}, ${floor}, NOW())
    ON CONFLICT (scope) DO UPDATE
    SET next_value = GREATEST(business_sequences.next_value, ${floor}),
        updated_at = NOW()
  `
}

/** Atomically increments and returns the new sequence value (1-based when starting from empty). */
export async function allocateSequence(tx: Tx, scope: string): Promise<number> {
  const rows = await tx.$queryRaw<{ next_value: number }[]>`
    INSERT INTO business_sequences (scope, next_value, updated_at)
    VALUES (${scope}, 1, NOW())
    ON CONFLICT (scope) DO UPDATE
    SET next_value = business_sequences.next_value + 1,
        updated_at = NOW()
    RETURNING next_value
  `
  const value = rows[0]?.next_value
  if (value == null || !Number.isFinite(Number(value))) {
    throw new Error(`Failed to allocate sequence for scope: ${scope}`)
  }
  return Number(value)
}

export function maxDispatchSequenceFromNumbers(dispatchNos: string[], year: number): number {
  const prefix = `D-${year}-`
  let max = 0
  for (const dispatchNo of dispatchNos) {
    if (!dispatchNo.startsWith(prefix)) continue
    const suffix = dispatchNo.slice(prefix.length)
    if (!/^\d{4}$/.test(suffix)) continue
    max = Math.max(max, parseInt(suffix, 10))
  }
  return max
}
