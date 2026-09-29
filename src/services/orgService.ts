import orgSeed from '@/data/org-seed.json'
import { api, isApiMode } from '@/lib/api'
import { loadFromStorage, saveToStorage } from '@/lib/storage'
import type { Department, Employee, JobRole } from '@/types/org'

type OrgStore = {
  departments: Department[]
  jobRoles: JobRole[]
  employees: Employee[]
  stageRoles: Array<{ stageCode: string; jobRoleCode: string }>
}

const STORAGE_KEY = 'org'

function defaultStore(): OrgStore {
  return orgSeed as OrgStore
}

function getStore(): OrgStore {
  return loadFromStorage(STORAGE_KEY, defaultStore())
}

function persist(store: OrgStore): void {
  saveToStorage(STORAGE_KEY, JSON.stringify(store))
}

export const orgService = {
  async listDepartments(): Promise<Department[]> {
    if (isApiMode) return api<Department[]>('/org/departments')
    return getStore().departments.filter((d) => d.active !== false)
  },

  async listJobRoles(): Promise<JobRole[]> {
    if (isApiMode) return api<JobRole[]>('/org/job-roles')
    return getStore().jobRoles.filter((r) => r.active !== false)
  },

  async listEmployees(): Promise<Employee[]> {
    if (isApiMode) return api<Employee[]>('/org/employees')
    return getStore().employees.filter((e) => e.active)
  },

  async listEmployeesForStage(stageCode: string): Promise<Employee[]> {
    if (isApiMode) return api<Employee[]>(`/org/employees/for-stage/${stageCode}`)
    const store = getStore()
    const roleCodes = new Set(
      store.stageRoles.filter((s) => s.stageCode === stageCode).map((s) => s.jobRoleCode),
    )
    if (!roleCodes.size) return store.employees.filter((e) => e.active)
    return store.employees.filter(
      (e) => e.active && e.jobRoles.some((jr) => roleCodes.has(jr.code)),
    )
  },

  async createDepartment(input: { code: string; name: string }): Promise<Department> {
    if (isApiMode) {
      return api<Department>('/org/departments', { method: 'POST', body: JSON.stringify(input) })
    }
    const store = getStore()
    const row: Department = {
      id: `dept-${Date.now()}`,
      code: input.code.toUpperCase(),
      name: input.name,
      sortOrder: store.departments.length + 1,
      active: true,
    }
    store.departments.push(row)
    persist(store)
    return row
  },

  async createJobRole(input: {
    code: string
    label: string
    departmentId?: string
  }): Promise<JobRole> {
    if (isApiMode) {
      return api<JobRole>('/org/job-roles', { method: 'POST', body: JSON.stringify(input) })
    }
    const store = getStore()
    const row: JobRole = {
      id: `jr-${Date.now()}`,
      code: input.code.toUpperCase(),
      label: input.label,
      departmentId: input.departmentId,
      sortOrder: store.jobRoles.length + 1,
      active: true,
    }
    store.jobRoles.push(row)
    persist(store)
    return row
  },

  async createEmployee(input: {
    name: string
    email?: string
    departmentId?: string
    jobRoleCodes?: string[]
  }): Promise<Employee> {
    if (isApiMode) {
      return api<Employee>('/org/employees', { method: 'POST', body: JSON.stringify(input) })
    }
    const store = getStore()
    const dept = store.departments.find((d) => d.id === input.departmentId)
    const roles = (input.jobRoleCodes ?? []).map((code, i) => {
      const jr = store.jobRoles.find((r) => r.code === code)
      return { code, label: jr?.label ?? code, isPrimary: i === 0 }
    })
    const row: Employee = {
      id: `emp-${Date.now()}`,
      name: input.name,
      email: input.email,
      departmentId: input.departmentId,
      departmentName: dept?.name,
      active: true,
      jobRoles: roles,
    }
    store.employees.push(row)
    persist(store)
    return row
  },

  getEmployeeById(id: string): Employee | undefined {
    return getStore().employees.find((e) => e.id === id)
  },

  resetToSeed(): void {
    persist(defaultStore())
  },
}
