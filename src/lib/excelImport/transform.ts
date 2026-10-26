import type {
  ColumnMapping,
  DuctImportFieldKey,
  ImportRowDraft,
  NormalizedDuctRow,
  ParsedSheet,
} from '@/types/excelImport'
import { validateRow } from './validate'
import {
  deriveShopDrawingRow,
  gaugeNumberFromBand,
  parseImportNumber,
} from './shopDrawingCalc'
import { extractShopDrawingSummaryCleat } from './shopDrawingParse'

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
  const drafts = indices.map((sourceRowIndex, i) => {
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

  const sheetCleatTotal = extractShopDrawingSummaryCleat(sheet.rawRows)
  if (sheetCleatTotal !== undefined && sheetCleatTotal > 0) {
    const validDrafts = drafts.filter((d) => !d.excluded && d.errors.length === 0)
    const totalQty = validDrafts.reduce(
      (sum, d) => sum + (parseNum(d.values.quantity) ?? 0),
      0,
    )
    if (totalQty > 0) {
      for (const d of validDrafts) {
        const qty = parseNum(d.values.quantity) ?? 0
        if (d.values.rmt === undefined || d.values.rmt === '') {
          d.values.rmt = (sheetCleatTotal * qty) / totalQty
        }
      }
    }
  }

  return drafts
}

export function normalizeRow(draft: ImportRowDraft): NormalizedDuctRow | null {
  if (draft.excluded) return null
  const v = draft.values
  const w1Raw = parseNum(v.w1)
  const h1Raw = parseNum(v.h1)
  const w2Raw = parseNum(v.w2)
  const h2Raw = parseNum(v.h2)
  const w1 = toMm(w1Raw)
  const h1 = toMm(h1Raw)
  const w2 = toMm(w2Raw)
  const h2 = toMm(h2Raw)
  const shopMode = w1 !== undefined || h1 !== undefined || w2 !== undefined || h2 !== undefined

  let width = toMm(parseNum(v.width))
  let height = toMm(parseNum(v.height))
  if (shopMode) {
    const faces = [w1, w2].filter((n) => n !== undefined && n > 0) as number[]
    const depths = [h1, h2].filter((n) => n !== undefined && n > 0) as number[]
    width = faces.length ? Math.max(...faces) : width ?? 0
    height = depths.length ? Math.max(...depths) : height ?? 0
  }

  const rawLength = parseNum(v.length)
  const length = toLengthMm(rawLength)
  const quantity = parseNum(v.quantity)
  const tagRaw = v.tagNo != null ? String(v.tagNo).trim() : ''
  if (!tagRaw || length === undefined || !quantity) {
    return null
  }
  if (!shopMode && (width === undefined || height === undefined)) {
    return null
  }
  if (shopMode && (width === undefined || width <= 0) && (height === undefined || height <= 0)) {
    const desc = String(v.description ?? '').toUpperCase()
    if (!desc.includes('ENDCAP') && !desc.includes('CAP')) return null
  }

  const derived = deriveShopDrawingRow(
    shopMode ? w1Raw : width,
    shopMode ? h1Raw : height,
    shopMode ? w2Raw : (height && height > 0 ? width : 0),
    shopMode ? h2Raw : height,
    shopMode ? rawLength : length,
    quantity,
  )

  const areaSqm =
    parseImportNumber(v.area) ??
    parseImportNumber(v.areaSqFt) ??
    derived.areaSqFt

  const excel24g = parseImportNumber(v.sft24g)
  const excel22g = parseImportNumber(v.sft22g)
  const excel20g = parseImportNumber(v.sft20g)
  const hasExcelGaugeBucket =
    (excel24g !== undefined && excel24g > 0) ||
    (excel22g !== undefined && excel22g > 0) ||
    (excel20g !== undefined && excel20g > 0)

  const sft24g = hasExcelGaugeBucket ? (excel24g ?? 0) : (excel24g ?? derived.sft24g)
  const sft22g = hasExcelGaugeBucket ? (excel22g ?? 0) : (excel22g ?? derived.sft22g)
  const sft20g = hasExcelGaugeBucket ? (excel20g ?? 0) : (excel20g ?? derived.sft20g)

  const gaugeFromBuckets =
    excel24g !== undefined && excel24g > 0
      ? 24
      : excel22g !== undefined && excel22g > 0
        ? 22
        : excel20g !== undefined && excel20g > 0
          ? 20
          : undefined

  const resolvedGauge =
    parseNum(v.gauge) !== undefined
      ? Math.round(parseNum(v.gauge)!)
      : (gaugeFromBuckets ?? gaugeNumberFromBand(derived.band))

  const resolvedCleat = parseImportNumber(v.cleat) ?? derived.cleat
  const resolvedCorner = parseImportNumber(v.corner) ?? derived.corner
  const resolvedNBolt = parseImportNumber(v.nBolt) ?? derived.nBolt

  return {
    tagNo: tagRaw,
    description: String(v.description ?? '').trim() || 'OFLINE',
    dai: parseNum(v.dai),
    width: width ?? 0,
    height: height ?? 0,
    w1,
    h1,
    w2,
    h2,
    length,
    quantity: Math.max(0, Math.round(quantity)),
    gauge: resolvedGauge,
    area: areaSqm,
    areaSqFt: areaSqm,
    sft24g,
    sft22g,
    sft20g,
    corner: resolvedCorner,
    nBolt: resolvedNBolt,
    cleat: resolvedCleat,
    // Store summary cleat share in rmt when rmt is provided, or per-line cleat otherwise
    rmt: parseNum(v.rmt) ?? resolvedCleat,
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
