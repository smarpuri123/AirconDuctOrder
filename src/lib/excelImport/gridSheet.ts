import type { ParsedSheet, ParsedWorkbook } from '@/types/excelImport'
import type { CanonicalColumn } from './canonicalTemplate'

function rowHasData(row: string[]): boolean {
  return row.some((c) => String(c).trim() !== '')
}

export function emptyGridRows(rowCount: number, colCount: number): string[][] {
  return Array.from({ length: rowCount }, () => Array(colCount).fill(''))
}

export function buildParsedSheetFromGrid(
  columns: CanonicalColumn[],
  dataRows: string[][],
  sheetName = 'Pasted data',
): ParsedSheet {
  const headers = columns.map((c) => c.header)
  const colCount = headers.length
  const normalizedData = dataRows
    .map((row) => {
      const out = Array(colCount).fill('')
      for (let i = 0; i < colCount; i++) out[i] = row[i] ?? ''
      return out
    })
    .filter(rowHasData)

  const rawRows = [headers, ...normalizedData]
  const headerRowIndex = 0
  const dataRowIndices: number[] = []
  for (let i = 1; i < rawRows.length; i++) {
    dataRowIndices.push(i)
  }

  return {
    name: sheetName,
    rowCount: rawRows.length,
    colCount,
    headerRowIndex,
    headers,
    rawRows,
    dataRowIndices,
    issues: [],
  }
}

export function buildPasteWorkbook(
  columns: CanonicalColumn[],
  dataRows: string[][],
): ParsedWorkbook {
  const sheet = buildParsedSheetFromGrid(columns, dataRows)
  return {
    fileName: 'pasted-schedule.tsv',
    sheets: [sheet],
  }
}

/** Parse TSV/CSV text from Excel clipboard (tab-separated rows). */
export function parseClipboardTable(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows: string[][] = []
  for (const line of lines) {
    if (line === '' && rows.length > 0 && rows[rows.length - 1].every((c) => c === '')) continue
    rows.push(line.split('\t').map((c) => c.trim()))
  }
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === '')) {
    rows.pop()
  }
  return rows
}

/** If first pasted row matches column headers (normalized), return data rows only. */
export function stripHeaderRowIfPresent(
  pasted: string[][],
  columns: CanonicalColumn[],
): string[][] {
  if (pasted.length === 0) return pasted
  const first = pasted[0]
  const expected = columns.map((c) => c.header.trim().toLowerCase())
  const match =
    first.length >= expected.length &&
    expected.every((h, i) => (first[i] ?? '').trim().toLowerCase() === h)
  return match ? pasted.slice(1) : pasted
}
