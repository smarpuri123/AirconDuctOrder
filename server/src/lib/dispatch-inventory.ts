import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/**
 * Increments dispatched quantity only when enough ready stock remains.
 * Returns false when the row would exceed ordered or ready quantity.
 */
export async function incrementDispatchedQtyIfAvailable(
  tx: Tx,
  customerOrderItemId: string,
  quantity: number,
): Promise<boolean> {
  if (quantity <= 0) return false
  const updated = await tx.$executeRaw`
    UPDATE customer_order_items
    SET dispatched_qty = dispatched_qty + ${quantity}
    WHERE id = ${customerOrderItemId}
      AND dispatched_qty + ${quantity} <= ordered_qty
      AND dispatched_qty + ${quantity} <= ready_qty
  `
  return updated === 1
}
