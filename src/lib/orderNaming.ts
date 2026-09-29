export function formatCustomerOrderNo(projectName: string, enquiryNo: string): string {
  return `${projectName.trim()} (${enquiryNo.trim()})`
}
