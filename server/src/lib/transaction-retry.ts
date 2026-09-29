import { Prisma } from '@prisma/client'

const DEADLOCK_SQL_STATE = '40P01'
const SERIALIZATION_FAILURE = '40001'
const MAX_ATTEMPTS = 5

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034'
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    return code === DEADLOCK_SQL_STATE || code === SERIALIZATION_FAILURE
  }
  return false
}

function backoffMs(attempt: number): number {
  return Math.min(50 * 2 ** attempt, 500)
}

export async function runTransactionWithRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  const { prisma } = await import('./prisma.js')
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(fn, options)
    } catch (error) {
      lastError = error
      if (!isRetryableTransactionError(error) || attempt === MAX_ATTEMPTS - 1) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)))
    }
  }
  throw lastError
}
