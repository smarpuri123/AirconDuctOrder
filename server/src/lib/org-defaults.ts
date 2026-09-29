export const WORKFLOW_STAGES = [
  'enquiry',
  'design_review',
  'order',
  'manufacturing',
  'dispatch',
] as const

export type WorkflowStageCode = (typeof WORKFLOW_STAGES)[number]

export const DEFAULT_DEPARTMENTS = [
  { code: 'COMMERCIAL', name: 'Commercial / Sales', sortOrder: 1 },
  { code: 'DESIGN', name: 'Design / Engineering', sortOrder: 2 },
  { code: 'PRODUCTION', name: 'Production', sortOrder: 3 },
  { code: 'DISPATCH', name: 'Dispatch / Logistics', sortOrder: 4 },
  { code: 'ACCOUNTS', name: 'Accounts', sortOrder: 5 },
  { code: 'ADMIN', name: 'Administration', sortOrder: 6 },
]

export const DEFAULT_JOB_ROLES: Array<{
  code: string
  label: string
  departmentCode: string
  sortOrder: number
}> = [
  { code: 'SALES_EXEC', label: 'Sales Executive', departmentCode: 'COMMERCIAL', sortOrder: 1 },
  { code: 'SALES_LEAD', label: 'Commercial Lead', departmentCode: 'COMMERCIAL', sortOrder: 2 },
  { code: 'COMMERCIAL_PIC', label: 'Commercial PIC', departmentCode: 'COMMERCIAL', sortOrder: 3 },
  { code: 'OFFICE_COORD', label: 'Office Coordinator', departmentCode: 'COMMERCIAL', sortOrder: 4 },
  { code: 'DESIGN_ENGINEER', label: 'Design Engineer', departmentCode: 'DESIGN', sortOrder: 1 },
  { code: 'DESIGN_LEAD', label: 'Design In-charge', departmentCode: 'DESIGN', sortOrder: 2 },
  { code: 'ESTIMATION', label: 'Estimation / BOM', departmentCode: 'DESIGN', sortOrder: 3 },
  { code: 'PRODUCTION_INCHARGE', label: 'Production In-charge', departmentCode: 'PRODUCTION', sortOrder: 1 },
  { code: 'SHOP_SUPERVISOR', label: 'Shop Supervisor', departmentCode: 'PRODUCTION', sortOrder: 2 },
  { code: 'QA_QC', label: 'QA / QC', departmentCode: 'PRODUCTION', sortOrder: 3 },
  { code: 'DISPATCHER', label: 'Dispatch Coordinator', departmentCode: 'DISPATCH', sortOrder: 1 },
  { code: 'LOGISTICS', label: 'Logistics', departmentCode: 'DISPATCH', sortOrder: 2 },
  { code: 'ACCOUNTS', label: 'Accounts', departmentCode: 'ACCOUNTS', sortOrder: 1 },
  { code: 'ADMIN', label: 'System Admin', departmentCode: 'ADMIN', sortOrder: 1 },
]

export const DEFAULT_STAGE_ROLE_MAP: Array<{ stageCode: WorkflowStageCode; jobRoleCode: string }> = [
  { stageCode: 'enquiry', jobRoleCode: 'SALES_EXEC' },
  { stageCode: 'enquiry', jobRoleCode: 'SALES_LEAD' },
  { stageCode: 'enquiry', jobRoleCode: 'COMMERCIAL_PIC' },
  { stageCode: 'enquiry', jobRoleCode: 'OFFICE_COORD' },
  { stageCode: 'design_review', jobRoleCode: 'DESIGN_ENGINEER' },
  { stageCode: 'design_review', jobRoleCode: 'DESIGN_LEAD' },
  { stageCode: 'design_review', jobRoleCode: 'ESTIMATION' },
  { stageCode: 'order', jobRoleCode: 'SALES_LEAD' },
  { stageCode: 'order', jobRoleCode: 'ACCOUNTS' },
  { stageCode: 'order', jobRoleCode: 'ESTIMATION' },
  { stageCode: 'manufacturing', jobRoleCode: 'PRODUCTION_INCHARGE' },
  { stageCode: 'manufacturing', jobRoleCode: 'SHOP_SUPERVISOR' },
  { stageCode: 'manufacturing', jobRoleCode: 'QA_QC' },
  { stageCode: 'dispatch', jobRoleCode: 'DISPATCHER' },
  { stageCode: 'dispatch', jobRoleCode: 'LOGISTICS' },
]
