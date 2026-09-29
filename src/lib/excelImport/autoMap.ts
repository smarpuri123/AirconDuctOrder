import type { ColumnMapping, DuctImportFieldKey, MappingSuggestion, ParsedSheet } from '@/types/excelImport'
import { FIELD_ALIASES, DUCT_IMPORT_FIELDS } from './fields'
import { normalizeHeader, fingerprintHeaders } from './normalize'
import { findBestTemplate } from './templates'

function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85
  const aSet = new Set(a.split(' '))
  const bSet = new Set(b.split(' '))
  let inter = 0
  for (const t of aSet) if (bSet.has(t)) inter++
  const union = aSet.size + bSet.size - inter
  return union ? inter / union : 0
}

function matchField(header: string): { key: DuctImportFieldKey; confidence: number } | null {
  const n = normalizeHeader(header)
  if (!n) return null
  let best: { key: DuctImportFieldKey; confidence: number } | null = null
  for (const field of DUCT_IMPORT_FIELDS) {
    const aliases = FIELD_ALIASES[field.key]
    for (const alias of aliases) {
      const score = similarity(n, normalizeHeader(alias))
      if (score >= 0.7 && (!best || score > best.confidence)) {
        best = { key: field.key, confidence: Math.round(score * 100) }
      }
    }
    const labelScore = similarity(n, normalizeHeader(field.label))
    if (labelScore >= 0.75 && (!best || labelScore * 100 > best.confidence)) {
      best = { key: field.key, confidence: Math.round(labelScore * 100) }
    }
  }
  return best
}

export function suggestMappings(
  sheet: ParsedSheet,
  options?: { customerId?: string },
): MappingSuggestion {
  const fp = fingerprintHeaders(sheet.headers)
  const template = findBestTemplate(fp, options?.customerId)

  const usedFields = new Set<DuctImportFieldKey>()
  const mappings: ColumnMapping[] = sheet.headers.map((header, excelIndex) => {
    if (!header.trim()) {
      return { excelHeader: header, excelIndex, fieldKey: null, confidence: 0 }
    }
    const norm = normalizeHeader(header)
    if (template?.mappings[norm]) {
      const key = template.mappings[norm]
      usedFields.add(key)
      return { excelHeader: header, excelIndex, fieldKey: key, confidence: 100 }
    }
    const m = matchField(header)
    if (m && !usedFields.has(m.key)) {
      usedFields.add(m.key)
      return { excelHeader: header, excelIndex, fieldKey: m.key, confidence: m.confidence }
    }
    return { excelHeader: header, excelIndex, fieldKey: null, confidence: 0 }
  })

  return {
    mappings,
    templateId: template?.id,
    templateName: template?.name,
  }
}
