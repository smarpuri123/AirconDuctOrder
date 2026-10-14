import { prisma } from './prisma.js'

/** Reject a code already used by a client or by another project. Comparison ignores case. */
export async function assertCodeAvailable(
  code: string,
  ignore: { projectId?: string; customerId?: string } = {},
): Promise<string | null> {
  const trimmed = code.trim()
  if (!trimmed) return 'Code is required.'

  const project = await prisma.project.findFirst({
    where: {
      code: { equals: trimmed, mode: 'insensitive' },
      ...(ignore.projectId ? { NOT: { id: ignore.projectId } } : {}),
    },
    select: { id: true },
  })
  if (project) return 'This code is already used by another project.'

  const customer = await prisma.customer.findFirst({
    where: {
      code: { equals: trimmed, mode: 'insensitive' },
      ...(ignore.customerId ? { NOT: { id: ignore.customerId } } : {}),
    },
    select: { id: true },
  })
  if (customer) return 'This code is already used by a client.'

  return null
}
