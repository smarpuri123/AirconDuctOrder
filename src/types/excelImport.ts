export type ExcelImportStep =
  | 'upload'
  | 'structure'
  | 'mapping'
  | 'rows'
  | 'validate'
  | 'preview'
  | 'done'

export type DuctImportFieldKey =
  | 'tagNo'
  | 'description'
  | 'dai'
  | 'width'
  | 'height'
  | 'length'
  | 'quantity'
  | 'gauge'
  | 'area'
  | 'rmt'

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
  length: number
  quantity: number
  gauge?: number
  area?: number
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
