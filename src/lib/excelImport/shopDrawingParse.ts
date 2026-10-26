import type { ColumnMapping, DuctImportFieldKey, ParsedSheet } from '@/types/excelImport'
import { normalizeHeader } from './normalize'

export interface ShopDrawingLayout {
  titleEndRow: number
  headerRowIndex: number
  subHeaderRowIndex: number
  dataStartRow: number
}

function rowText(row: string[]): string {
  return row.map((c) => normalizeHeader(c)).join('|')
}

/** Detect two-row or single-row shop drawing header (DUCT NO + W1/H1/… sub-row). */
export function detectShopDrawingLayout(rawRows: string[][]): ShopDrawingLayout | null {
  const limit = Math.min(rawRows.length, 35)
  for (let i = 0; i < limit; i++) {
    const primary = rowText(rawRows[i] ?? [])
    const secondary = rowText(rawRows[i + 1] ?? [])
    const hasDuctPrimary =
      (primary.includes('duct') &&
        (primary.includes('no') || primary.includes('number') || primary.includes('tag'))) ||
      primary.includes('ductno') ||
      primary.includes('tagno')
    const hasDimsPrimary =
      primary.includes('w1') && (primary.includes('h1') || primary.includes('qty'))
    const hasDimsSecondary =
      secondary.includes('w1') ||
      (secondary.includes('w') && secondary.includes('h1')) ||
      (secondary.includes('l') && secondary.includes('qty'))

    if (hasDuctPrimary && hasDimsSecondary) {
      return {
        titleEndRow: Math.max(0, i - 1),
        headerRowIndex: i,
        subHeaderRowIndex: i + 1,
        dataStartRow: i + 2,
      }
    }
    if (hasDimsPrimary) {
      return {
        titleEndRow: Math.max(0, i - 1),
        headerRowIndex: i,
        subHeaderRowIndex: i,
        dataStartRow: i + 1,
      }
    }
  }
  return null
}

const SUBHEADER_ALIASES: Record<string, DuctImportFieldKey> = {
  w1: 'w1',
  h1: 'h1',
  w2: 'w2',
  h2: 'h2',
  l: 'length',
  qty: 'quantity',
  qnty: 'quantity',
  quantity: 'quantity',
  corner: 'corner',
  cornner: 'corner',
  nbolt: 'nBolt',
  cleat: 'cleat',
}

const PRIMARY_ALIASES: Record<string, DuctImportFieldKey> = {
  ductno: 'tagNo',
  ductnumber: 'tagNo',
  tagno: 'tagNo',
  description: 'description',
  desc: 'description',
  area: 'areaSqFt',
  areasqm: 'areaSqFt',
  areasqft: 'areaSqFt',
  '24g': 'sft24g',
  '22g': 'sft22g',
  '20g': 'sft20g',
  corner: 'corner',
  cornner: 'corner',
  nbolt: 'nBolt',
  cleat: 'cleat',
}

function mapShopColumn(primary: string, secondary: string, excelIndex: number): ColumnMapping {
  const p = normalizeHeader(primary)
  const s = normalizeHeader(secondary)
  let fieldKey: DuctImportFieldKey | null = null

  if (s && SUBHEADER_ALIASES[s]) {
    fieldKey = SUBHEADER_ALIASES[s]
  } else if (p && PRIMARY_ALIASES[p]) {
    fieldKey = PRIMARY_ALIASES[p]
  } else if (p.includes('duct') && p.includes('no')) {
    fieldKey = 'tagNo'
  } else if (p === 'description' || p === 'desc') {
    fieldKey = 'description'
  } else if (p.includes('area')) {
    fieldKey = 'areaSqFt'
  } else if (p === '24g' || s.includes('750mm') && s.includes('upto')) {
    fieldKey = 'sft24g'
  } else if (p === '22g' || s.includes('1500mm') && s.includes('750')) {
    fieldKey = 'sft22g'
  } else if (p === '20g' || s.includes('above') && s.includes('1500')) {
    fieldKey = 'sft20g'
  } else if (p.includes('corn') || s.includes('corn')) {
    fieldKey = 'corner'
  } else if (p.includes('bolt') || s.includes('bolt')) {
    fieldKey = 'nBolt'
  } else if (p.includes('cleat') || s.includes('cleat')) {
    fieldKey = 'cleat'
  }

  return {
    excelHeader: [primary, secondary].filter(Boolean).join(' / ') || `Column ${excelIndex + 1}`,
    excelIndex,
    fieldKey,
    confidence: fieldKey ? 95 : 0,
  }
}

export function buildShopDrawingMappings(sheet: ParsedSheet): ColumnMapping[] {
  const layout = detectShopDrawingLayout(sheet.rawRows)
  if (!layout) return []

  const primary = sheet.rawRows[layout.headerRowIndex] ?? []
  const secondary = sheet.rawRows[layout.subHeaderRowIndex] ?? []
  const colCount = Math.max(primary.length, secondary.length)
  const mappings: ColumnMapping[] = []
  for (let i = 0; i < colCount; i++) {
    mappings.push(mapShopColumn(primary[i] ?? '', secondary[i] ?? '', i))
  }
  return mappings
}

export function applyShopDrawingLayout(sheet: ParsedSheet): ParsedSheet {
  const layout = detectShopDrawingLayout(sheet.rawRows)
  if (!layout) return sheet

  const primary = sheet.rawRows[layout.headerRowIndex] ?? []
  const secondary = sheet.rawRows[layout.subHeaderRowIndex] ?? []
  const colCount = Math.max(primary.length, secondary.length)
  const headers: string[] = []
  for (let i = 0; i < colCount; i++) {
    const p = (primary[i] ?? '').trim()
    const s = (secondary[i] ?? '').trim()
    headers.push(s || p || `Column ${i + 1}`)
  }

  const mappings = buildShopDrawingMappings(sheet)
  const qtyColIdx = mappings.find((m) => m.fieldKey === 'quantity')?.excelIndex ?? 7
  const lenColIdx = mappings.find((m) => m.fieldKey === 'length')?.excelIndex ?? 6

  const dataRowIndices: number[] = []
  for (let i = layout.dataStartRow; i < sheet.rawRows.length; i++) {
    const row = sheet.rawRows[i] ?? []
    const tag = String(row[0] ?? '').trim()
    const col1 = String(row[1] ?? '').trim()
    if (!tag && !row.some((c) => String(c).trim())) continue
    if (/^total|grand\s*total/i.test(tag) || /^total|grand\s*total/i.test(col1)) break
    if (/^(corn+er|n\/bolt|cleat|gasket|24g|22g|20g)/i.test(tag)) break

    // Unnamed TOTAL row at the bottom of the schedule: no Duct No, no Description, no Length, but has summed Qty
    const lenVal = String(row[lenColIdx] ?? '').trim()
    const qtyVal = String(row[qtyColIdx] ?? '').trim()
    if (!tag && !col1 && !lenVal && qtyVal) break

    // Skip non-data footer/banner lines where Duct No is empty or both L and QTY are empty
    if (!tag || (!lenVal && !qtyVal)) continue

    dataRowIndices.push(i)
  }

  return {
    ...sheet,
    headerRowIndex: layout.headerRowIndex,
    headers,
    dataRowIndices,
    issues: [
      ...sheet.issues,
      {
        type: 'title_block',
        message: `Shop drawing layout: data from row ${layout.dataStartRow + 1}`,
      },
    ],
  }
}

/**
 * Extracts the explicit CLEAT total from the bottom summary block (`CLEAT | <qty> | NOS`)
 * or the TOTAL row (Column R / index 17) of a shop-drawing sheet when present.
 */
export function extractShopDrawingSummaryCleat(rawRows: string[][]): number | undefined {
  const layout = detectShopDrawingLayout(rawRows)
  if (!layout) return undefined

  for (let i = layout.dataStartRow; i < rawRows.length; i++) {
    const row = rawRows[i] ?? []
    const c0 = normalizeHeader(String(row[0] ?? ''))
    const c1 = normalizeHeader(String(row[1] ?? ''))
    if (c0 === 'cleat' || c1 === 'cleat') {
      for (let col = 1; col < row.length; col++) {
        const raw = String(row[col] ?? '').replace(/,/g, '').trim()
        if (!raw) continue
        const n = Number(raw)
        if (Number.isFinite(n) && n > 0) return n
      }
    }
  }

  for (let i = layout.dataStartRow; i < rawRows.length; i++) {
    const row = rawRows[i] ?? []
    const tag = String(row[0] ?? '').trim()
    const col1 = String(row[1] ?? '').trim()
    const lenVal = String(row[6] ?? '').trim()
    const qtyVal = String(row[7] ?? '').trim()
    const isTotalRow =
      /^total|grand\s*total/i.test(tag) ||
      /^total|grand\s*total/i.test(col1) ||
      (!tag && !col1 && !lenVal && Boolean(qtyVal))

    if (isTotalRow) {
      const rawR = String(row[17] ?? '').replace(/,/g, '').trim()
      if (rawR) {
        const n = Number(rawR)
        if (Number.isFinite(n) && n > 0) return n
      }
    }
  }

  return undefined
}

export function isShopDrawingSheet(sheet: ParsedSheet): boolean {
  return detectShopDrawingLayout(sheet.rawRows) !== null
}
