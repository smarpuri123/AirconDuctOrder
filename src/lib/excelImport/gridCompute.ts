import type { DuctImportFieldKey } from '@/types/excelImport'
import {
  DUCT_SCHEDULE_COLUMN_CATALOG,
  type DuctScheduleColumnDef,
} from './ductScheduleColumnCatalog'
import { deriveShopDrawingRow, parseImportNumber } from './shopDrawingCalc'

export interface GridColumnView extends DuctScheduleColumnDef {
  visible: boolean
}

export function formatGridNumber(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Math.abs(n) < 1e-6) return ''
  const rounded = Math.round(n * 10000) / 10000
  return String(rounded)
}

export function computeRowDerived(
  inputByKey: Partial<Record<DuctImportFieldKey, string>>,
): Partial<Record<DuctImportFieldKey, string>> {
  const w1 = parseImportNumber(inputByKey.w1) ?? parseImportNumber(inputByKey.width)
  const h1 = parseImportNumber(inputByKey.h1) ?? parseImportNumber(inputByKey.height)
  const w2 = parseImportNumber(inputByKey.w2) ?? parseImportNumber(inputByKey.width)
  const h2 = parseImportNumber(inputByKey.h2) ?? parseImportNumber(inputByKey.height)
  const length = parseImportNumber(inputByKey.length)
  const qty = parseImportNumber(inputByKey.quantity)

  const hasDimsOrQty =
    w1 !== undefined ||
    h1 !== undefined ||
    w2 !== undefined ||
    h2 !== undefined ||
    qty !== undefined

  if (!hasDimsOrQty) {
    return {}
  }

  const d = deriveShopDrawingRow(w1, h1, w2, h2, length, qty)
  return {
    areaSqFt: formatGridNumber(d.areaSqFt),
    sft24g: formatGridNumber(d.sft24g),
    sft22g: formatGridNumber(d.sft22g),
    sft20g: formatGridNumber(d.sft20g),
    corner: formatGridNumber(d.corner),
    nBolt: formatGridNumber(d.nBolt),
    cleat: formatGridNumber(d.cleat),
  }
}

export function sumColumnFromRows(
  rows: string[][],
  columns: GridColumnView[],
  fieldKey: DuctImportFieldKey,
): number {
  const idx = columns.findIndex((c) => c.fieldKey === fieldKey)
  if (idx < 0) return 0
  let sum = 0
  for (const row of rows) {
    const n = parseImportNumber(row[idx])
    if (n !== undefined) sum += n
  }
  return sum
}

export function pivotTotals(
  rows: string[][],
  columns: GridColumnView[],
): Partial<Record<DuctImportFieldKey, number>> {
  let totalCorner = 0
  let totalNBolt = 0
  let totalCleat = 0
  let totalArea = 0
  let total24g = 0
  let total22g = 0
  let total20g = 0

  for (const row of rows) {
    const inputByKey: Partial<Record<DuctImportFieldKey, string>> = {}
    columns.forEach((col, i) => {
      if (col.role === 'input') {
        inputByKey[col.fieldKey] = row[i] ?? ''
      }
    })
    const w1 = parseImportNumber(inputByKey.w1) ?? parseImportNumber(inputByKey.width)
    const h1 = parseImportNumber(inputByKey.h1) ?? parseImportNumber(inputByKey.height)
    const w2 = parseImportNumber(inputByKey.w2) ?? parseImportNumber(inputByKey.width)
    const h2 = parseImportNumber(inputByKey.h2) ?? parseImportNumber(inputByKey.height)
    const length = parseImportNumber(inputByKey.length)
    const qty = parseImportNumber(inputByKey.quantity)
    const d = deriveShopDrawingRow(w1, h1, w2, h2, length, qty)

    totalCorner += d.corner
    totalNBolt += d.nBolt
    totalCleat += d.cleat
    totalArea += d.areaSqFt
    total24g += d.sft24g
    total22g += d.sft22g
    total20g += d.sft20g
  }

  return {
    pivotTotalCorner: Math.round(totalCorner),
    pivotTotalNBolt: Math.round(totalNBolt),
    pivotTotalCleat: Math.round(totalCleat),
    pivotTotalAreaSqFt: Math.round(totalArea * 100) / 100,
    pivotTotal24g: Math.round(total24g * 100) / 100,
    pivotTotal22g: Math.round(total22g * 100) / 100,
    pivotTotal20g: Math.round(total20g * 100) / 100,
  }
}

export function mergeInputAndCalculatedRow(
  inputCells: string[],
  columns: GridColumnView[],
): string[] {
  const inputByKey: Partial<Record<DuctImportFieldKey, string>> = {}
  columns.forEach((col, i) => {
    if (col.role === 'input') {
      inputByKey[col.fieldKey] = inputCells[i] ?? ''
    }
  })
  const derived = computeRowDerived(inputByKey)
  return columns.map((col) => {
    if (col.role === 'calculated') {
      return derived[col.fieldKey] ?? ''
    }
    const idx = columns.findIndex((c) => c.fieldKey === col.fieldKey)
    return inputCells[idx] ?? ''
  })
}

export function inputColumnIndices(columns: GridColumnView[]): number[] {
  return columns
    .map((c, i) => (c.role === 'input' ? i : -1))
    .filter((i) => i >= 0)
}

export function allCatalogColumns(): DuctScheduleColumnDef[] {
  return [...DUCT_SCHEDULE_COLUMN_CATALOG]
}

export function labelForColumn(col: DuctScheduleColumnDef): string {
  const role =
    col.role === 'calculated'
      ? ' (calculated)'
      : col.role === 'pivot'
        ? ' (pivot total)'
        : ''
  return `${col.header}${role}`
}

export function columnGroupLabel(col: DuctScheduleColumnDef): string {
  if (col.role === 'calculated') return 'Calculated columns'
  if (col.role === 'pivot') return 'Pivot totals (footer)'
  if (col.group === 'shop') return 'Shop drawing inputs'
  return 'Standard inputs'
}
