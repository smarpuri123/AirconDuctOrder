export interface Department {
  id: string
  code: string
  name: string
  active?: boolean
  sortOrder?: number
}

export interface JobRole {
  id: string
  code: string
  label: string
  departmentId?: string | null
  active?: boolean
  sortOrder?: number
  department?: Department | null
}

export interface EmployeeJobRoleRef {
  code: string
  label: string
  isPrimary: boolean
}

export interface Employee {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  employeeCode?: string | null
  departmentId?: string | null
  departmentName?: string
  active: boolean
  jobRoles: EmployeeJobRoleRef[]
}

export const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  enquiry: 'Enquiry',
  design_review: 'Design review',
  order: 'Order',
  manufacturing: 'Manufacturing',
  dispatch: 'Dispatch',
}
