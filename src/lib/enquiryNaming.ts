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

export function nextEnquiryNoForClientProject(
  enquiries: { enquiryNo: string; customerId?: string; projectId?: string }[],
  customerCode: string,
  projectCode: string,
  customerId?: string,
  projectId?: string,
): string {
  const prefix = enquiryNoPrefix(customerCode, projectCode)
  const scoped =
    customerId && projectId
      ? enquiries.filter((e) => e.customerId === customerId && e.projectId === projectId)
      : enquiries.filter((e) => e.enquiryNo.startsWith(prefix))
  const next = maxEnquirySequenceFromNumbers(scoped.map((e) => e.enquiryNo), prefix) + 1
  return formatEnquiryNo(customerCode, projectCode, next)
}
