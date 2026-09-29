import type { DuctImportFieldKey, ImportRowDraft } from '@/types/excelImport'
import { fieldDef } from './fields'

function parseNum(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

export function validateRow(
  draft: ImportRowDraft,
  byField: Map<DuctImportFieldKey, number>,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  if (draft.excluded) return { errors, warnings }

  const required: DuctImportFieldKey[] = ['tagNo', 'width', 'height', 'length', 'quantity']
  for (const key of required) {
    if (!byField.has(key)) {
      errors.push(`${fieldDef(key).label} is not mapped`)
      continue
    }
    const raw = draft.values[key]
    if (raw === undefined || raw === '') {
      errors.push(`${fieldDef(key).label} is missing`)
    }
  }

  const qty = parseNum(draft.values.quantity)
  if (qty !== undefined && qty <= 0) errors.push('Quantity must be greater than 0')

  const w = parseNum(draft.values.width)
  const h = parseNum(draft.values.height)
  if (w !== undefined && w <= 0) errors.push('Width must be greater than 0')
  if (h !== undefined && h <= 0) errors.push('Height must be greater than 0')

  if (w !== undefined && w > 0 && w < 25) {
    warnings.push('Width looks like metres — will convert to mm on import')
  }

  return { errors, warnings }
}

export function findDuplicateTags(rows: ImportRowDraft[]): Map<string, number[]> {
  const map = new Map<string, number[]>()
  rows.forEach((r, idx) => {
    if (r.excluded) return
    const tag = String(r.values.tagNo ?? '').trim()
    if (!tag) return
    const list = map.get(tag) ?? []
    list.push(idx)
    map.set(tag, list)
  })
  const dupes = new Map<string, number[]>()
  for (const [tag, indices] of map) {
    if (indices.length > 1) dupes.set(tag, indices)
  }
  return dupes
}

export function applyDuplicateErrors(rows: ImportRowDraft[]): ImportRowDraft[] {
  const dupes = findDuplicateTags(rows)
  return rows.map((r, idx) => {
    const tag = String(r.values.tagNo ?? '').trim()
    const dupeList = dupes.get(tag)
    if (!dupeList || !dupeList.includes(idx)) return r
    return {
      ...r,
      errors: [...r.errors, `Duplicate tag number: ${tag}`],
    }
  })
}
