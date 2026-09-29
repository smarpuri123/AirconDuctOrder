import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, GripVertical, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { enquiryService } from '@/services/enquiryService'
import { getCurrentUser } from '@/lib/currentUser'
import { parseExcelFile } from '@/lib/excelImport/parser'
import { suggestMappings } from '@/lib/excelImport/autoMap'
import { DUCT_IMPORT_FIELDS } from '@/lib/excelImport/fields'
import { fingerprintHeaders } from '@/lib/excelImport/normalize'
import {
  buildImportRows,
  normalizeRow,
  summarizeImport,
} from '@/lib/excelImport/transform'
import { applyDuplicateErrors } from '@/lib/excelImport/validate'
import {
  mappingsToTemplateRecord,
  saveMappingTemplate,
  touchTemplate,
} from '@/lib/excelImport/templates'
import { saveImportAudit } from '@/lib/excelImport/audit'
import { filesToPayloadsWithProgress } from '@/lib/enquiryDocuments'
import type {
  ColumnMapping,
  DuctImportFieldKey,
  ExcelImportStep,
  ImportRowDraft,
  ParsedSheet,
  ParsedWorkbook,
} from '@/types/excelImport'

const STEPS: ExcelImportStep[] = ['upload', 'structure', 'mapping', 'rows', 'validate', 'preview']

type ImportTableColumn =
  | { kind: 'field'; key: DuctImportFieldKey; label: string }
  | { kind: 'excel'; index: number; label: string }

function buildImportTableColumns(mappings: ColumnMapping[]): ImportTableColumn[] {
  const cols: ImportTableColumn[] = []
  for (const field of DUCT_IMPORT_FIELDS) {
    if (mappings.some((m) => m.fieldKey === field.key)) {
      cols.push({ kind: 'field', key: field.key, label: field.label })
    }
  }
  for (const m of mappings) {
    if (!m.fieldKey && m.excelHeader.trim()) {
      cols.push({ kind: 'excel', index: m.excelIndex, label: m.excelHeader })
    }
  }
  return cols
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

function cellForColumn(
  row: ImportRowDraft,
  col: ImportTableColumn,
  sheet: ParsedSheet,
  mode: 'raw' | 'normalized',
): string {
  if (col.kind === 'excel') {
    return formatCellValue(sheet.rawRows[row.sourceRowIndex]?.[col.index])
  }
  if (mode === 'normalized') {
    const norm = normalizeRow(row)
    if (!norm) return formatCellValue(row.values[col.key])
    const normalized: Record<DuctImportFieldKey, string | number | undefined> = {
      tagNo: norm.tagNo,
      description: norm.description,
      dai: norm.dai,
      width: norm.width,
      height: norm.height,
      length: norm.length,
      quantity: norm.quantity,
      gauge: norm.gauge,
      area: norm.area,
      rmt: norm.rmt,
    }
    return formatCellValue(normalized[col.key])
  }
  return formatCellValue(row.values[col.key])
}

interface ImportDataTableProps {
  columns: ImportTableColumn[]
  rows: ImportRowDraft[]
  sheet: ParsedSheet
  mode: 'raw' | 'normalized'
  showActions?: boolean
  showStatus?: boolean
  onMoveRow?: (from: number, to: number) => void
  onToggleExclude?: (rowId: string) => void
}

function ImportDataTable({
  columns,
  rows,
  sheet,
  mode,
  showActions,
  showStatus,
  onMoveRow,
  onToggleExclude,
}: ImportDataTableProps) {
  return (
    <div className="overflow-auto border border-border rounded-lg max-h-[min(32rem,70vh)]">
      <table className="w-full text-sm min-w-max">
        <thead className="bg-background sticky top-0 z-10 border-b border-border">
          <tr>
            <th className="p-2 text-left font-medium whitespace-nowrap">Excel row</th>
            {columns.map((col) => (
              <th key={col.kind === 'field' ? col.key : `x-${col.index}`} className="p-2 text-left font-medium whitespace-nowrap">
                {col.label}
                {col.kind === 'excel' && (
                  <span className="block text-[10px] font-normal text-text-secondary">(unmapped)</span>
                )}
              </th>
            ))}
            {showStatus && <th className="p-2 text-left font-medium whitespace-nowrap">Status</th>}
            {showActions && <th className="p-2 text-left font-medium whitespace-nowrap">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const status =
              r.excluded ? 'Excluded' : r.errors.length ? r.errors.join('; ') : '✓ Ready'
            return (
              <tr
                key={r.id}
                className={`border-t border-border ${r.excluded ? 'opacity-40' : ''} ${r.errors.length && !r.excluded ? 'bg-error/5' : ''}`}
              >
                <td className="p-2 tabular-nums whitespace-nowrap">{r.sourceRowIndex + 1}</td>
                {columns.map((col) => (
                  <td
                    key={col.kind === 'field' ? col.key : `x-${col.index}`}
                    className="p-2 whitespace-nowrap max-w-[14rem] truncate"
                    title={cellForColumn(r, col, sheet, mode)}
                  >
                    {cellForColumn(r, col, sheet, mode)}
                  </td>
                ))}
                {showStatus && (
                  <td className={`p-2 text-xs max-w-xs ${r.errors.length && !r.excluded ? 'text-error' : 'text-success'}`}>
                    {status}
                  </td>
                )}
                {showActions && onMoveRow && onToggleExclude && (
                  <td className="p-2 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onMoveRow(idx, idx - 1)} disabled={idx === 0}>
                        ↑
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onMoveRow(idx, idx + 1)} disabled={idx === rows.length - 1}>
                        ↓
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onToggleExclude(r.id)}>
                        {r.excluded ? 'Include' : 'Exclude'}
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ExcelImportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const enquiry = id ? enquiryService.getEnquiryById(id) : undefined

  const [step, setStep] = useState<ExcelImportStep>('upload')
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [templateName, setTemplateName] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | undefined>()
  const [rows, setRows] = useState<ImportRowDraft[]>([])
  const [rowOrder, setRowOrder] = useState<number[]>([])
  const [dragCol, setDragCol] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [sourceFile, setSourceFile] = useState<File | null>(null)

  const sheet: ParsedSheet | undefined = workbook?.sheets[sheetIndex]

  const onFile = async (file: File) => {
    setError('')
    try {
      const wb = await parseExcelFile(file)
      setSourceFile(file)
      setWorkbook(wb)
      setSheetIndex(0)
      const sh = wb.sheets[0]
      const suggestion = suggestMappings(sh)
      setMappings(suggestion.mappings)
      setTemplateName(suggestion.templateName ?? null)
      setTemplateId(suggestion.templateId)
      setRowOrder(sh.dataRowIndices)
      setStep('structure')
    } catch {
      setError('Could not read this Excel file.')
    }
  }

  const refreshRows = useCallback(() => {
    if (!sheet) return
    setRows((prev) => {
      const excludedBySource = new Map(prev.map((r) => [r.sourceRowIndex, r.excluded]))
      const built = buildImportRows(sheet, mappings, rowOrder)
      const merged = built.map((r) => ({
        ...r,
        excluded: excludedBySource.get(r.sourceRowIndex) ?? r.excluded,
      }))
      return applyDuplicateErrors(merged)
    })
  }, [sheet, mappings, rowOrder])

  const goMapping = () => {
    if (!sheet) return
    const suggestion = suggestMappings(sheet)
    setMappings(suggestion.mappings)
    setTemplateName(suggestion.templateName ?? null)
    setTemplateId(suggestion.templateId)
    setStep('mapping')
  }

  const goRows = () => {
    refreshRows()
    setStep('rows')
  }

  const goValidate = () => {
    refreshRows()
    setStep('validate')
  }

  const summary = useMemo(() => summarizeImport(rows), [rows])

  const tableColumns = useMemo(() => buildImportTableColumns(mappings), [mappings])

  useEffect(() => {
    if (step === 'rows' || step === 'validate' || step === 'preview') {
      refreshRows()
    }
  }, [rowOrder, step, refreshRows])

  const mapField = (fieldKey: DuctImportFieldKey, excelIndex: number | null) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (excelIndex !== null && m.excelIndex === excelIndex) {
          return { ...m, fieldKey, confidence: 100 }
        }
        if (m.fieldKey === fieldKey && excelIndex !== m.excelIndex) {
          return { ...m, fieldKey: null, confidence: 0 }
        }
        return m
      }),
    )
  }

  const unmapColumn = (excelIndex: number) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.excelIndex === excelIndex ? { ...m, fieldKey: null, confidence: 0 } : m,
      ),
    )
  }

  const moveRow = (from: number, to: number) => {
    if (to < 0 || to >= rowOrder.length) return
    setRowOrder((order) => {
      const next = [...order]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const toggleExclude = (rowId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, excluded: !r.excluded } : r)),
    )
  }

  const handleConfirmImport = async () => {
    if (!id || !workbook || !sheet) return
    setImporting(true)
    setError('')
    try {
      const normalized = rows
        .map((r) => ({ draft: r, norm: normalizeRow(r) }))
        .filter((x) => x.norm && !x.draft.errors.length && !x.draft.excluded)

      const tagSet = new Set<string>()
      let totalQty = 0
      let totalArea = 0
      for (const { norm } of normalized) {
        if (!norm) continue
        tagSet.add(norm.tagNo)
        totalQty += norm.quantity
        totalArea += norm.area ?? 0
      }

      const excelFile = sourceFile
        ? (await filesToPayloadsWithProgress([sourceFile]))[0]
        : undefined

      await enquiryService.saveDuctScheduleImport(id, {
        ductTags: tagSet.size,
        totalQty,
        totalArea: Math.round(totalArea * 100) / 100,
        notes: `Excel import: ${workbook.fileName} (${normalized.length} lines)`,
        lines: normalized.map(({ norm }) => ({
          tagNo: norm!.tagNo,
          description: norm!.description,
          width: norm!.width,
          height: norm!.height,
          length: norm!.length,
          quantity: norm!.quantity,
          area: norm!.area,
          gauge: norm!.gauge,
          dai: norm!.dai,
          rmt: norm!.rmt,
        })),
        excelFile,
      })

      const fp = fingerprintHeaders(sheet.headers)
      const tplName =
        templateName ?? `Format ${workbook.fileName.replace(/\.xlsx?$/i, '')}`
      saveMappingTemplate({
        name: tplName,
        headerFingerprint: fp,
        mappings: mappingsToTemplateRecord(mappings),
      })
      if (templateId) touchTemplate(templateId)

      const user = getCurrentUser()
      saveImportAudit({
        id: `imp_${Date.now()}`,
        enquiryId: id,
        fileName: workbook.fileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.name,
        mappingTemplateId: templateId,
        recordsTotal: rows.length,
        recordsImported: normalized.length,
        recordsRejected: rows.length - normalized.length,
        validationSummary: summary,
      })

      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (!enquiry) {
    return <p className="text-text-secondary p-6">Enquiry not found.</p>
  }

  return (
    <div className="max-w-[min(100%,90rem)] mx-auto space-y-6 pb-12 px-2 sm:px-0">
      <button
        type="button"
        onClick={() => navigate(`/enquiries/${id}`)}
        className="flex items-center gap-2 text-text-secondary min-h-11"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to enquiry
      </button>

      <div>
        <h2 className="text-2xl font-semibold">Import duct schedule from Excel</h2>
        <p className="text-text-secondary text-sm mt-1">
          {enquiry.enquiryNo} · {enquiry.projectName}
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s) => (
          <span
            key={s}
            className={`px-2 py-1 rounded-full border ${
              step === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary'
            }`}
          >
            {s}
          </span>
        ))}
      </nav>

      {error && <p className="text-error text-sm">{error}</p>}

      {step === 'upload' && (
        <Card>
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:bg-background">
            <Upload className="w-10 h-10 text-primary" />
            <span className="font-medium">Upload Excel (.xlsx, .xls)</span>
            <span className="text-xs text-text-secondary text-center max-w-md">
              Original file is not modified. We detect headers, map columns, validate rows, then
              update design extraction totals.
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
              }}
            />
          </label>
        </Card>
      )}

      {step === 'structure' && sheet && workbook && (
        <Card className="space-y-4">
          <p className="font-medium">Workbook structure</p>
          <p className="text-sm text-text-secondary">
            File: <strong>{workbook.fileName}</strong> · Sheet: <strong>{sheet.name}</strong> ·
            Header row: <strong>{sheet.headerRowIndex + 1}</strong> · Data rows:{' '}
            <strong>{sheet.dataRowIndices.length}</strong>
          </p>
          {sheet.issues.map((issue) => (
            <p key={issue.message} className="text-sm text-warning">⚠ {issue.message}</p>
          ))}
          {templateName && (
            <p className="text-sm text-success font-medium">
              Known Excel format detected — mapping “{templateName}” will be applied.
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('upload')}>Change file</Button>
            <Button onClick={goMapping}>Continue to mapping</Button>
          </div>
        </Card>
      )}

      {step === 'mapping' && sheet && (
        <Card className="space-y-6">
          <p className="text-sm text-text-secondary">
            Drag an Excel column onto an application field, or use Map from the column list.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 text-sm">Excel columns</h3>
              <ul className="space-y-2">
                {mappings
                  .filter((m) => m.excelHeader.trim())
                  .map((m) => (
                    <li
                      key={m.excelIndex}
                      draggable
                      onDragStart={() => setDragCol(m.excelIndex)}
                      onDragEnd={() => setDragCol(null)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm cursor-grab"
                    >
                      <GripVertical className="w-4 h-4 text-text-secondary shrink-0" />
                      <span className="flex-1 truncate">{m.excelHeader}</span>
                      {m.fieldKey && (
                        <button
                          type="button"
                          className="text-xs text-primary"
                          onClick={() => unmapColumn(m.excelIndex)}
                        >
                          Unmap
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-sm">Application fields</h3>
              <ul className="space-y-2">
                {DUCT_IMPORT_FIELDS.map((field) => {
                  const mapped = mappings.find((m) => m.fieldKey === field.key)
                  return (
                    <li
                      key={field.key}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragCol !== null) mapField(field.key, dragCol)
                      }}
                      className={`px-3 py-2 rounded-lg border text-sm ${
                        mapped
                          ? 'border-primary bg-primary/5'
                          : field.required
                            ? 'border-warning/50 border-dashed'
                            : 'border-border border-dashed'
                      }`}
                    >
                      <div className="font-medium">
                        {field.label}
                        {field.required && ' *'}
                      </div>
                      {mapped ? (
                        <p className="text-xs text-text-secondary mt-0.5">
                          ← {mapped.excelHeader}
                          {mapped.confidence > 0 && ` (${mapped.confidence}%)`}
                        </p>
                      ) : (
                        <p className="text-xs text-text-secondary mt-0.5">Drop column here</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('structure')}>Back</Button>
            <Button onClick={goRows}>Continue to rows</Button>
          </div>
        </Card>
      )}

      {step === 'rows' && sheet && (
        <Card className="space-y-4">
          <p className="text-sm text-text-secondary">
            All mapped Excel columns are shown below. Reorder or exclude rows (import preview only — Excel
            file unchanged). Scroll horizontally for extra columns.
          </p>
          <ImportDataTable
            columns={tableColumns}
            rows={rows}
            sheet={sheet}
            mode="raw"
            showActions
            onMoveRow={moveRow}
            onToggleExclude={toggleExclude}
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('mapping')}>Back</Button>
            <Button onClick={goValidate}>Validate</Button>
          </div>
        </Card>
      )}

      {(step === 'validate' || step === 'preview') && sheet && (
        <Card className="space-y-4">
          <p className="text-sm">
            <strong>{summary.ready}</strong> ready ·{' '}
            <strong className="text-warning">{summary.attention}</strong> need attention ·{' '}
            <strong>{summary.excluded}</strong> excluded
          </p>
          {step === 'preview' && (
            <p className="text-xs text-text-secondary">
              Preview shows normalized values (dimensions in mm) ready for import.
            </p>
          )}
          <ImportDataTable
            columns={tableColumns}
            rows={rows}
            sheet={sheet}
            mode={step === 'preview' ? 'normalized' : 'raw'}
            showStatus
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('rows')}>Back</Button>
            {step === 'validate' && (
              <Button onClick={() => setStep('preview')}>Preview import</Button>
            )}
            {step === 'preview' && (
              <Button onClick={handleConfirmImport} disabled={importing || summary.ready === 0}>
                {importing ? 'Importing…' : `Import ${summary.ready} records`}
              </Button>
            )}
          </div>
        </Card>
      )}

      {step === 'done' && (
        <Card className="space-y-4 text-center py-8">
          <p className="text-lg font-semibold text-success">Import complete</p>
          <p className="text-sm text-text-secondary">
            Design extraction totals updated. Mapping saved for future files with the same headers.
          </p>
          <Button onClick={() => navigate(`/enquiries/${id}`)}>Return to enquiry</Button>
        </Card>
      )}
    </div>
  )
}
