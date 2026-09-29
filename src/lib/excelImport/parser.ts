import * as XLSX from 'xlsx'
import type { ParsedSheet, ParsedWorkbook, SheetIssue } from '@/types/excelImport'
import { normalizeHeader } from './normalize'
import { FIELD_ALIASES } from './fields'
const ALL_ALIASES = new Set(
  Object.values(FIELD_ALIASES).flat().map((a) => normalizeHeader(a)),
)

function cellToString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return String(v)
  return String(v).trim()
}

function scoreHeaderRow(row: string[]): number {
  let score = 0
  for (const cell of row) {
    const n = normalizeHeader(cell)
    if (!n) continue
    if (ALL_ALIASES.has(n)) score += 3
    else if (n.length <= 12 && /[a-z]/.test(n)) score += 1
  }
  return score
}

function detectHeaderRow(rows: string[][]): number {
  let bestIdx = 0
  let bestScore = 0
  const limit = Math.min(rows.length, 25)
  for (let i = 0; i < limit; i++) {
    const score = scoreHeaderRow(rows[i])
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestScore >= 3 ? bestIdx : Math.min(5, rows.length - 1)
}

function isDataRow(row: string[]): boolean {
  const nonEmpty = row.filter((c) => c !== '').length
  if (nonEmpty < 2) return false
  const first = row[0]
  if (/^project\s*:/i.test(first)) return false
  if (/flat oval|boq|location/i.test(row.join(' '))) return false
  const tagLike = row[0]
  if (tagLike && /^tag/i.test(tagLike) && row.some((c) => /description|width|qty/i.test(c))) {
    return false
  }
  return true
}

export function parseExcelFile(file: File): Promise<ParsedWorkbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
          const sheet = wb.Sheets[name]
          const merges = sheet['!merges'] as XLSX.Range[] | undefined
          const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
            header: 1,
            defval: '',
            raw: false,
          }) as unknown[][]
          const rawRows = rows.map((r) => (Array.isArray(r) ? r.map(cellToString) : []))
          const issues: SheetIssue[] = []
          if (rawRows.length === 0) {
            issues.push({ type: 'empty_sheet', message: 'Sheet is empty' })
          }
          if (merges?.length) {
            issues.push({
              type: 'merged_cells',
              message: `${merges.length} merged cell region(s) detected — review header row`,
            })
          }
          const headerRowIndex = detectHeaderRow(rawRows)
          const headers = rawRows[headerRowIndex]?.map((h) => h.replace(/\r\n/g, ' ').trim()) ?? []
          const seen = new Map<string, number>()
          headers.forEach((h) => {
            const k = normalizeHeader(h)
            if (!k) return
            seen.set(k, (seen.get(k) ?? 0) + 1)
          })
          for (const [h, count] of seen) {
            if (count > 1) {
              issues.push({ type: 'duplicate_header', message: `Duplicate header: ${h}` })
            }
          }
          if (headers.every((h) => !h)) {
            issues.push({ type: 'no_header', message: 'Could not detect a header row' })
          }
          if (headerRowIndex > 0) {
            issues.push({
              type: 'title_block',
              message: `Title rows above header (row ${headerRowIndex + 1} is header)`,
            })
          }
          const dataRowIndices: number[] = []
          for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            if (isDataRow(rawRows[i])) dataRowIndices.push(i)
          }
          const colCount = Math.max(headers.length, ...rawRows.map((r) => r.length))
          return {
            name,
            rowCount: rawRows.length,
            colCount,
            headerRowIndex,
            headers,
            rawRows,
            dataRowIndices,
            issues,
          }
        })
        resolve({ fileName: file.name, sheets })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

