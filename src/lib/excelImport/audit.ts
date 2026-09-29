import type { ImportAuditRecord } from '@/types/excelImport'

const KEY = 'ecovent_excel_import_audit'

export function saveImportAudit(record: ImportAuditRecord) {
  const list = listImportAudits()
  list.unshift(record)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)))
}

export function listImportAudits(enquiryId?: string): ImportAuditRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    const all = raw ? (JSON.parse(raw) as ImportAuditRecord[]) : []
    return enquiryId ? all.filter((a) => a.enquiryId === enquiryId) : all
  } catch {
    return []
  }
}
