/** Standard customer order title: `Progress City India (ENQ-2026-0002)` */
export function formatCustomerOrderNo(projectName: string, enquiryNo: string): string {
  const project = projectName.trim()
  const enq = enquiryNo.trim()
  return `${project} (${enq})`
}
