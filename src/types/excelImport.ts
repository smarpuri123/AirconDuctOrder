export type ExcelImportStep = 'upload' | 'review' | 'done'

export type DuctImportFieldKey =
  | 'tagNo'
  | 'description'
  | 'dai'
  | 'width'
  | 'height'
  | 'w1'
  | 'h1'
  | 'w2'
  | 'h2'
  | 'length'
  | 'quantity'
  | 'gauge'
  | 'area'
  | 'areaSqFt'
  | 'sft24g'
  | 'sft22g'
  | 'sft20g'
  | 'corner'
  | 'nBolt'
  | 'cleat'
  | 'rmt'
  | 'pivotTotalCorner'
  | 'pivotTotalNBolt'
  | 'pivotTotalCleat'
  | 'pivotTotalAreaSqFt'
  | 'pivotTotal24g'
  | 'pivotTotal22g'
  | 'pivotTotal20g'

export interface DuctImportFieldDef {
  key: DuctImportFieldKey
  label: string
  required: boolean
}

export interface ParsedWorkbook {
  fileName: string
  sheets: ParsedSheet[]
}

export interface ParsedSheet {
  name: string
  rowCount: number
  colCount: number
  headerRowIndex: number
  headers: string[]
  rawRows: string[][] // all rows as strings
  dataRowIndices: number[]
  issues: SheetIssue[]
}

export interface SheetIssue {
  type: 'empty_sheet' | 'duplicate_header' | 'merged_cells' | 'no_header' | 'title_block'
  message: string
}

export interface ColumnMapping {
  excelHeader: string
  excelIndex: number
  fieldKey: DuctImportFieldKey | null
  confidence: number
}

export interface MappingSuggestion {
  mappings: ColumnMapping[]
  templateId?: string
  templateName?: string
}

export interface ImportRowDraft {
  id: string
  sourceRowIndex: number
  excluded: boolean
  values: Partial<Record<DuctImportFieldKey, string | number>>
  errors: string[]
  warnings: string[]
}

export interface NormalizedDuctRow {
  tagNo: string
  description: string
  dai?: number
  width: number
  height: number
  w1?: number
  h1?: number
  w2?: number
  h2?: number
  length: number
  quantity: number
  gauge?: number
  area?: number
  areaSqFt?: number
  sft24g?: number
  sft22g?: number
  sft20g?: number
  corner?: number
  nBolt?: number
  cleat?: number
  rmt?: number
}

export interface ImportValidationSummary {
  ready: number
  attention: number
  excluded: number
}

export interface ImportAuditRecord {
  id: string
  enquiryId: string
  fileName: string
  uploadedAt: string
  uploadedBy: string
  mappingTemplateId?: string
  recordsTotal: number
  recordsImported: number
  recordsRejected: number
  validationSummary: ImportValidationSummary
}

export interface MappingTemplate {
  id: string
  name: string
  headerFingerprint: string
  mappings: Record<string, DuctImportFieldKey>
  customerId?: string
  createdAt: string
  lastUsedAt: string
}
