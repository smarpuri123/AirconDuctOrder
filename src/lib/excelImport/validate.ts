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

  const shopMode =
    byField.has('w1') || byField.has('h1') || byField.has('w2') || byField.has('h2')

  if (!byField.has('tagNo')) {
    errors.push(`${fieldDef('tagNo').label} is not mapped`)
  } else if (draft.values.tagNo === undefined || draft.values.tagNo === '') {
    errors.push(`${fieldDef('tagNo').label} is missing`)
  }

  if (shopMode) {
    for (const key of ['length', 'quantity'] as DuctImportFieldKey[]) {
      if (!byField.has(key)) {
        errors.push(`${fieldDef(key).label} is not mapped`)
        continue
      }
      if (draft.values[key] === undefined || draft.values[key] === '') {
        errors.push(`${fieldDef(key).label} is missing`)
      }
    }
  } else {
    const required: DuctImportFieldKey[] = ['width', 'height', 'length', 'quantity']
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
  }

  const qty = parseNum(draft.values.quantity)
  if (qty !== undefined && qty <= 0) errors.push('Quantity must be greater than 0')

  const w = parseNum(draft.values.width)
  const h = parseNum(draft.values.height)
  if (!shopMode) {
    if (w !== undefined && w <= 0) errors.push('Width must be greater than 0')
    if (h !== undefined && h <= 0) errors.push('Height must be greater than 0')
  }

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
  const shopRows = rows.some(
    (r) =>
      r.values.w1 !== undefined ||
      r.values.h1 !== undefined ||
      r.values.w2 !== undefined ||
      r.values.h2 !== undefined,
  )
  if (shopRows) {
    return rows.map((r, idx) => {
      const tag = String(r.values.tagNo ?? '').trim()
      const dupeList = findDuplicateTags(rows).get(tag)
      if (!dupeList || !dupeList.includes(idx) || dupeList[0] === idx) return r
      return {
        ...r,
        warnings: [...r.warnings, `Same duct number as another line: ${tag}`],
      }
    })
  }

  const dupes = findDuplicateTags(rows)
  return rows.map((r, idx) => {
    const tag = String(r.values.tagNo ?? '').trim()
    const dupeList = dupes.get(tag)
    if (!dupeList || !dupeList.includes(idx)) return r
    return {
      ...r,
      errors: [...r.errors, `Duplicate duct number: ${tag}`],
    }
  })
}
