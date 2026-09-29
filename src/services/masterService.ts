import crmSeed from '@/data/crm-seed.json'
import { api, isApiMode } from '@/lib/api'
import { loadFromStorage, saveToStorage } from '@/lib/storage'
import type { MasterLookup } from '@/types/crm'
import { MASTER_CATEGORY } from '@/types/crm'

type CrmSeed = {
  masters: MasterLookup[]
}

function getMastersData(): MasterLookup[] {
  if (isApiMode) {
    return loadFromStorage('masters', (crmSeed as CrmSeed).masters)
  }
  return loadFromStorage('masters', (crmSeed as CrmSeed).masters)
}

function persistMasters(masters: MasterLookup[]): void {
  saveToStorage('masters', JSON.stringify(masters))
}

export const masterService = {
  async list(category?: string): Promise<MasterLookup[]> {
    if (isApiMode) {
      const q = category ? `?category=${encodeURIComponent(category)}` : ''
      return api<MasterLookup[]>(`/masters${q}`)
    }
    const all = getMastersData()
    return category ? all.filter((m) => m.category === category && m.active) : all.filter((m) => m.active)
  },

  async contactRoles(): Promise<MasterLookup[]> {
    return this.list(MASTER_CATEGORY.CONTACT_ROLE)
  },

  async enquirySources(): Promise<MasterLookup[]> {
    return this.list(MASTER_CATEGORY.ENQUIRY_SOURCE)
  },

  async enquiryPriorities(): Promise<MasterLookup[]> {
    return this.list(MASTER_CATEGORY.ENQUIRY_PRIORITY)
  },

  async addMaster(input: { category: string; code: string; label: string; sortOrder?: number }): Promise<MasterLookup> {
    if (isApiMode) {
      return api<MasterLookup>('/masters', { method: 'POST', body: JSON.stringify(input) })
    }
    const masters = getMastersData()
    const row: MasterLookup = {
      id: `master-${Date.now()}`,
      category: input.category,
      code: input.code.toUpperCase(),
      label: input.label,
      sortOrder: input.sortOrder ?? masters.length + 1,
      active: true,
    }
    masters.push(row)
    persistMasters(masters)
    return row
  },

  labelForCode(category: string, code: string, masters: MasterLookup[]): string {
    return masters.find((m) => m.category === category && m.code === code)?.label ?? code
  },
}
