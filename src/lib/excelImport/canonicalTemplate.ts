import type { ColumnMapping, DuctImportFieldKey, ParsedSheet } from '@/types/excelImport'
import { normalizeHeader } from './normalize'

export interface CanonicalColumn {
  fieldKey: DuctImportFieldKey
  header: string
  required: boolean
}

/** Column names users must use (download template). Order matches export file. */
export const DUCT_SCHEDULE_CANONICAL_COLUMNS: CanonicalColumn[] = [
  { fieldKey: 'tagNo', header: 'Duct No', required: true },
  { fieldKey: 'description', header: 'Description', required: false },
  { fieldKey: 'dai', header: 'Diameter (DAI)', required: false },
  { fieldKey: 'width', header: 'Width (mm)', required: true },
  { fieldKey: 'height', header: 'Height (mm)', required: true },
  { fieldKey: 'length', header: 'Length (mm)', required: true },
  { fieldKey: 'quantity', header: 'Quantity', required: true },
  { fieldKey: 'gauge', header: 'Gauge', required: false },
  { fieldKey: 'area', header: 'Area (m²)', required: false },
  { fieldKey: 'rmt', header: 'RMT', required: false },
]

const KNOWN_HEADERS = new Map(
  DUCT_SCHEDULE_CANONICAL_COLUMNS.map((c) => [normalizeHeader(c.header), c]),
)

export function ductScheduleTemplateHeaderRow(): string[] {
  return DUCT_SCHEDULE_CANONICAL_COLUMNS.map((c) => c.header)
}

/** Returns human-readable errors; empty array means headers match the template. */
export function validateDuctScheduleHeaders(headers: string[]): string[] {
  const errors: string[] = []
  const present = new Set<string>()

  for (const raw of headers) {
    const n = normalizeHeader(raw)
    if (!n) continue
    if (present.has(n)) {
      errors.push(`Duplicate column "${raw}".`)
      continue
    }
    present.add(n)
    if (!KNOWN_HEADERS.has(n)) {
      errors.push(`Unrecognized column "${raw}". Download the template and use those column names exactly.`)
    }
  }

  for (const col of DUCT_SCHEDULE_CANONICAL_COLUMNS) {
    if (col.required && !present.has(normalizeHeader(col.header))) {
      errors.push(`Missing required column "${col.header}".`)
    }
  }

  return errors
}

export function buildCanonicalMappings(sheet: ParsedSheet): ColumnMapping[] {
  return sheet.headers.map((header, excelIndex) => {
    const col = KNOWN_HEADERS.get(normalizeHeader(header))
    return {
      excelHeader: header,
      excelIndex,
      fieldKey: col?.fieldKey ?? null,
      confidence: col ? 100 : 0,
    }
  })
}
