import type {
  ColumnMapping,
  DuctImportFieldKey,
  ImportRowDraft,
  NormalizedDuctRow,
  ParsedSheet,
} from '@/types/excelImport'
import { validateRow } from './validate'

function parseNum(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/** BOQ files often store dimensions in metres; convert to mm when values look like metres. */
function toMm(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (value > 0 && value < 25) return Math.round(value * 1000)
  return Math.round(value)
}

function toLengthMm(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (value > 0 && value < 25) return Math.round(value * 1000)
  return Math.round(value)
}

export function buildImportRows(
  sheet: ParsedSheet,
  mappings: ColumnMapping[],
  rowOrder?: number[],
): ImportRowDraft[] {
  const byField = new Map<DuctImportFieldKey, number>()
  for (const m of mappings) {
    if (m.fieldKey) byField.set(m.fieldKey, m.excelIndex)
  }

  const indices = rowOrder ?? sheet.dataRowIndices
  return indices.map((sourceRowIndex, i) => {
    const row = sheet.rawRows[sourceRowIndex] ?? []
    const values: Partial<Record<DuctImportFieldKey, string | number>> = {}
    for (const [key, colIdx] of byField) {
      const raw = row[colIdx] ?? ''
      values[key] = raw
    }
    const draft: ImportRowDraft = {
      id: `row_${sourceRowIndex}_${i}`,
      sourceRowIndex,
      excluded: false,
      values,
      errors: [],
      warnings: [],
    }
    const { errors, warnings } = validateRow(draft, byField)
    draft.errors = errors
    draft.warnings = warnings
    return draft
  })
}

export function normalizeRow(draft: ImportRowDraft): NormalizedDuctRow | null {
  if (draft.excluded) return null
  const v = draft.values
  const width = toMm(parseNum(v.width))
  const height = toMm(parseNum(v.height))
  const length = toLengthMm(parseNum(v.length))
  const quantity = parseNum(v.quantity)
  const tagRaw = v.tagNo != null ? String(v.tagNo).trim() : ''
  if (!tagRaw || width === undefined || height === undefined || length === undefined || !quantity) {
    return null
  }
  return {
    tagNo: tagRaw,
    description: String(v.description ?? '').trim() || 'OFLINE',
    dai: parseNum(v.dai),
    width,
    height,
    length,
    quantity: Math.max(0, Math.round(quantity)),
    gauge: parseNum(v.gauge) !== undefined ? Math.round(parseNum(v.gauge)!) : undefined,
    area: parseNum(v.area),
    rmt: parseNum(v.rmt),
  }
}

export function summarizeImport(rows: ImportRowDraft[]) {
  let ready = 0
  let attention = 0
  let excluded = 0
  for (const r of rows) {
    if (r.excluded) {
      excluded++
      continue
    }
    if (r.errors.length) attention++
    else ready++
  }
  return { ready, attention, excluded }
}
