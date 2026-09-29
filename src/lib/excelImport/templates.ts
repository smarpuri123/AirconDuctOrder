import type { DuctImportFieldKey, MappingTemplate } from '@/types/excelImport'
import { normalizeHeader } from './normalize'

const STORAGE_KEY = 'ecovent_excel_mapping_templates'

function loadAll(): MappingTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MappingTemplate[]
  } catch {
    return []
  }
}

function saveAll(templates: MappingTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function listMappingTemplates(): MappingTemplate[] {
  return loadAll().sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
}

export function findBestTemplate(
  headerFingerprint: string,
  customerId?: string,
): MappingTemplate | undefined {
  const all = loadAll()
  const exact = all.find(
    (t) =>
      t.headerFingerprint === headerFingerprint &&
      (!customerId || !t.customerId || t.customerId === customerId),
  )
  if (exact) return exact
  return all.find((t) => t.headerFingerprint === headerFingerprint)
}

export function saveMappingTemplate(input: {
  name: string
  headerFingerprint: string
  mappings: Record<string, DuctImportFieldKey>
  customerId?: string
}): MappingTemplate {
  const all = loadAll()
  const now = new Date().toISOString()
  const existing = all.find(
    (t) => t.headerFingerprint === input.headerFingerprint && t.name === input.name,
  )
  if (existing) {
    existing.mappings = input.mappings
    existing.lastUsedAt = now
    saveAll(all)
    return existing
  }
  const template: MappingTemplate = {
    id: `tpl_${Date.now()}`,
    name: input.name,
    headerFingerprint: input.headerFingerprint,
    mappings: input.mappings,
    customerId: input.customerId,
    createdAt: now,
    lastUsedAt: now,
  }
  all.push(template)
  saveAll(all)
  return template
}

export function touchTemplate(id: string) {
  const all = loadAll()
  const t = all.find((x) => x.id === id)
  if (!t) return
  t.lastUsedAt = new Date().toISOString()
  saveAll(all)
}

export function mappingsToTemplateRecord(
  mappings: { excelHeader: string; fieldKey: DuctImportFieldKey | null }[],
): Record<string, DuctImportFieldKey> {
  const out: Record<string, DuctImportFieldKey> = {}
  for (const m of mappings) {
    if (!m.fieldKey || !m.excelHeader.trim()) continue
    out[normalizeHeader(m.excelHeader)] = m.fieldKey
  }
  return out
}
