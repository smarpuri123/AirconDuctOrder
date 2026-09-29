export interface Client {
  id: string
  code?: string | null
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  gstin?: string | null
  active?: boolean
  contacts?: Contact[]
  projects?: ProjectSummary[]
}

export interface Contact {
  id: string
  customerId: string
  firstName: string
  lastName?: string | null
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  designation?: string | null
  department?: string | null
  isPrimary: boolean
  active: boolean
}

export interface ProjectSummary {
  id: string
  customerId: string
  code: string
  name: string
  projectType?: string | null
  location?: string | null
  status: string
}

export interface ProjectContact {
  id: string
  projectId: string
  contactId: string
  role: string
  isPrimary: boolean
  isActive: boolean
  notes?: string | null
  contact: Contact
}

export interface ProjectDetail extends ProjectSummary {
  description?: string | null
  startDate?: string
  expectedCompletion?: string
  projectContacts?: ProjectContact[]
}

export interface MasterLookup {
  id: string
  category: string
  code: string
  label: string
  sortOrder: number
  active: boolean
}

export const MASTER_CATEGORY = {
  CONTACT_ROLE: 'CONTACT_ROLE',
  ENQUIRY_SOURCE: 'ENQUIRY_SOURCE',
  ENQUIRY_PRIORITY: 'ENQUIRY_PRIORITY',
  PROJECT_TYPE: 'PROJECT_TYPE',
} as const
