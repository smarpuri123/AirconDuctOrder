export const MASTER_CATEGORIES = {
  CONTACT_ROLE: 'CONTACT_ROLE',
  ENQUIRY_SOURCE: 'ENQUIRY_SOURCE',
  ENQUIRY_PRIORITY: 'ENQUIRY_PRIORITY',
  PROJECT_TYPE: 'PROJECT_TYPE',
} as const

export type MasterCategory = (typeof MASTER_CATEGORIES)[keyof typeof MASTER_CATEGORIES]

export const DEFAULT_MASTER_LOOKUPS: Array<{
  category: MasterCategory
  code: string
  label: string
  sortOrder: number
}> = [
  { category: 'CONTACT_ROLE', code: 'CLIENT_PM', label: 'Project Manager', sortOrder: 1 },
  { category: 'CONTACT_ROLE', code: 'SITE_ENGINEER', label: 'Site Engineer', sortOrder: 2 },
  { category: 'CONTACT_ROLE', code: 'PURCHASING', label: 'Procurement', sortOrder: 3 },
  { category: 'CONTACT_ROLE', code: 'CONSULTANT', label: 'Consultant', sortOrder: 4 },
  { category: 'CONTACT_ROLE', code: 'ARCHITECT', label: 'Architect', sortOrder: 5 },
  { category: 'CONTACT_ROLE', code: 'ACCOUNTS', label: 'Accounts', sortOrder: 6 },
  { category: 'CONTACT_ROLE', code: 'QA_QC', label: 'QA / QC', sortOrder: 7 },
  { category: 'CONTACT_ROLE', code: 'APPROVER', label: 'Approver', sortOrder: 8 },
  { category: 'CONTACT_ROLE', code: 'OTHER', label: 'Other', sortOrder: 99 },
  { category: 'ENQUIRY_SOURCE', code: 'EXISTING_CUSTOMER', label: 'Existing Customer', sortOrder: 1 },
  { category: 'ENQUIRY_SOURCE', code: 'REFERRAL', label: 'Referral', sortOrder: 2 },
  { category: 'ENQUIRY_SOURCE', code: 'WEBSITE', label: 'Website', sortOrder: 3 },
  { category: 'ENQUIRY_SOURCE', code: 'COLD_CALL', label: 'Cold Call', sortOrder: 4 },
  { category: 'ENQUIRY_SOURCE', code: 'TRADE_SHOW', label: 'Trade Show', sortOrder: 5 },
  { category: 'ENQUIRY_PRIORITY', code: 'LOW', label: 'Low', sortOrder: 1 },
  { category: 'ENQUIRY_PRIORITY', code: 'NORMAL', label: 'Normal', sortOrder: 2 },
  { category: 'ENQUIRY_PRIORITY', code: 'HIGH', label: 'High', sortOrder: 3 },
  { category: 'ENQUIRY_PRIORITY', code: 'URGENT', label: 'Urgent', sortOrder: 4 },
  { category: 'PROJECT_TYPE', code: 'COMMERCIAL', label: 'Commercial', sortOrder: 1 },
  { category: 'PROJECT_TYPE', code: 'INDUSTRIAL', label: 'Industrial', sortOrder: 2 },
  { category: 'PROJECT_TYPE', code: 'HEALTHCARE', label: 'Healthcare', sortOrder: 3 },
  { category: 'PROJECT_TYPE', code: 'INFRASTRUCTURE', label: 'Infrastructure', sortOrder: 4 },
]
