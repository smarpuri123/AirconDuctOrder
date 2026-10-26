import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Table2, Upload } from 'lucide-react'
import { DuctSchedulePasteGrid } from '@/components/excelImport/DuctSchedulePasteGrid'
import {
  DuctScheduleLinesTable,
  DuctScheduleSummaryTable,
} from '@/components/operations/DuctSchedulePanel'
import { buildPasteWorkbook } from '@/lib/excelImport/gridSheet'
import {
  getConfiguredGridColumnDefs,
  getConfiguredImportColumns,
  getConfiguredPivotColumnDefs,
} from '@/lib/excelImport/importColumnSettings'
import {
  buildMappingsForSheet,
  prepareSheetForImport,
  validateSheetHeaders,
} from '@/lib/excelImport/importMappings'
import { isShopDrawingSheet } from '@/lib/excelImport/shopDrawingParse'
import { summarizeDuctScheduleLines } from '@/lib/excelImport/shopDrawingCalc'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { enquiryService } from '@/services/enquiryService'
import { exportDuctScheduleImportTemplate } from '@/lib/excelExport'
import { getCurrentUser } from '@/lib/currentUser'
import { parseExcelFile } from '@/lib/excelImport/parser'
import {
  buildImportRows,
  normalizeRow,
  summarizeImport,
} from '@/lib/excelImport/transform'
import { applyDuplicateErrors } from '@/lib/excelImport/validate'
import { saveImportAudit } from '@/lib/excelImport/audit'
import { filesToPayloadsWithProgress } from '@/lib/enquiryDocuments'
import { logExcelIssue } from '@/lib/clientLogBuffer'
import type {
  ExcelImportStep,
  ImportRowDraft,
  NormalizedDuctRow,
  ParsedSheet,
  ParsedWorkbook,
} from '@/types/excelImport'

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

function RowIssuesTable({ rows }: { rows: ImportRowDraft[] }) {
  const problemRows = rows.filter((r) => r.errors.length > 0)
  if (problemRows.length === 0) return null

  return (
    <div className="overflow-auto border border-border rounded-lg max-h-[min(24rem,60vh)]">
      <table className="w-full text-sm">
        <thead className="bg-background sticky top-0 border-b border-border">
          <tr>
            <th className="p-2 text-left font-medium">Excel row</th>
            <th className="p-2 text-left font-medium">Duct No</th>
            <th className="p-2 text-left font-medium">Issue</th>
          </tr>
        </thead>
        <tbody>
          {problemRows.map((r) => (
            <tr key={r.id} className="border-t border-border bg-error/5">
              <td className="p-2 tabular-nums">{r.sourceRowIndex + 1}</td>
              <td className="p-2">{formatCellValue(r.values.tagNo)}</td>
              <td className="p-2 text-error text-xs">{r.errors.join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ExcelImportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const enquiry = id ? enquiryService.getEnquiryById(id) : undefined
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ExcelImportStep>('upload')
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [rows, setRows] = useState<ImportRowDraft[]>([])
  const [headerErrors, setHeaderErrors] = useState<string[]>([])
  const [error, setError] = useState('')
  const [parsingFile, setParsingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file')

  const importColumns = useMemo(() => getConfiguredImportColumns(), [step, importMode])
  const gridColumns = useMemo(() => getConfiguredGridColumnDefs(), [step, importMode])
  const pivotColumns = useMemo(() => getConfiguredPivotColumnDefs(), [step, importMode])
  const sheet: ParsedSheet | undefined = workbook?.sheets[sheetIndex]

  const summary = useMemo(() => summarizeImport(rows), [rows])

  const normalizedRows = useMemo(() => {
    const list: NormalizedDuctRow[] = []
    for (const r of rows) {
      if (r.excluded || r.errors.length > 0) continue
      const norm = normalizeRow(r)
      if (norm) list.push(norm)
    }
    return list
  }, [rows])

  const ductSummary = useMemo(
    () => summarizeDuctScheduleLines(normalizedRows),
    [normalizedRows],
  )

  const uniqueTagCount = useMemo(
    () => new Set(normalizedRows.map((r) => r.tagNo)).size,
    [normalizedRows],
  )

  const buildRowsFromSheet = useCallback((sh: ParsedSheet) => {
    const prepared = prepareSheetForImport(sh)
    const mappings = buildMappingsForSheet(prepared)
    const built = buildImportRows(prepared, mappings, prepared.dataRowIndices)
    return applyDuplicateErrors(built)
  }, [])

  const openFilePicker = () => {
    setImportMode('file')
    fileInputRef.current?.click()
  }

  const onFile = async (file: File) => {
    setError('')
    setHeaderErrors([])
    setParsingFile(true)
    try {
      const wb = await parseExcelFile(file)
      setSourceFile(file)
      setWorkbook(wb)
      const shopIdx = wb.sheets.findIndex((s) => isShopDrawingSheet(s))
      const initialIdx = shopIdx >= 0 ? shopIdx : 0
      setSheetIndex(initialIdx)
      const sh = wb.sheets[initialIdx]
      const columnErrors = validateSheetHeaders(sh)
      if (columnErrors.length > 0) {
        setHeaderErrors(columnErrors)
        logExcelIssue(
          `Excel header validation failed: ${file.name}`,
          columnErrors.join('; '),
        )
        setRows([])
        setStep('upload')
        return
      }
      const built = buildRowsFromSheet(sh)
      const problemCount = built.filter((r) => r.errors.length > 0).length
      if (problemCount > 0) {
        logExcelIssue(
          `Excel row validation: ${file.name}`,
          `${problemCount} row(s) with issues on sheet "${sh.name}"`,
        )
      }
      setRows(built)
      setStep('review')
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      logExcelIssue(`Could not read Excel file: ${file.name}`, detail)
      setError('Could not read this Excel file.')
    } finally {
      setParsingFile(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!id || !workbook || !sheet) return
    setImporting(true)
    setError('')
    try {
      const excelFile = sourceFile
        ? (await filesToPayloadsWithProgress([sourceFile]))[0]
        : undefined

      await enquiryService.saveDuctScheduleImport(id, {
        ductTags: uniqueTagCount,
        totalQty: ductSummary.totalQty,
        totalArea: Math.round(ductSummary.totalArea * 100) / 100,
        notes: `Excel import: ${workbook.fileName} (${normalizedRows.length} lines · CORNNER ${ductSummary.corner} · N/BOLT ${ductSummary.nBolt} · CLEAT ${ductSummary.cleat})`,
        lines: normalizedRows.map((norm) => ({
          tagNo: norm.tagNo,
          description: norm.description,
          width: norm.width,
          height: norm.height,
          length: norm.length,
          quantity: norm.quantity,
          area: norm.area,
          gauge: norm.gauge,
          dai: norm.dai,
          rmt: norm.rmt,
        })),
        excelFile,
      })

      const user = getCurrentUser()
      saveImportAudit({
        id: `imp_${Date.now()}`,
        enquiryId: id,
        fileName: workbook.fileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.name,
        recordsTotal: rows.length,
        recordsImported: normalizedRows.length,
        recordsRejected: rows.length - normalizedRows.length,
        validationSummary: summary,
      })

      setStep('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed'
      logExcelIssue(
        `Duct schedule import failed: ${workbook.fileName}`,
        `${msg}${id ? ` (enquiry ${id})` : ''}`,
      )
      setError(msg)
    } finally {
      setImporting(false)
    }
  }

  const requiredColumns = importColumns.filter((c) => c.required)
  const optionalColumns = importColumns.filter((c) => !c.required)

  const onPasteGridContinue = (gridDataRows: string[][]) => {
    setError('')
    setHeaderErrors([])
    setSourceFile(null)
    const inputIndices = gridColumns
      .map((c, i) => (c.role === 'input' ? i : -1))
      .filter((i) => i >= 0)
    const dataRows = gridDataRows.map((row) => inputIndices.map((i) => row[i] ?? ''))
    const wb = buildPasteWorkbook(importColumns, dataRows)
    setWorkbook(wb)
    setSheetIndex(0)
    const sh = wb.sheets[0]
    const built = buildRowsFromSheet(sh)
    const problemCount = built.filter((r) => r.errors.length > 0).length
    if (problemCount > 0) {
      logExcelIssue(
        'Paste grid row validation',
        `${problemCount} row(s) with issues`,
      )
    }
    setRows(built)
    setStep('review')
  }

  if (!enquiry) {
    return <p className="text-text-secondary p-6">Enquiry not found.</p>
  }

  return (
    <div
      className={`mx-auto space-y-6 pb-12 px-2 sm:px-0 ${
        importMode === 'paste' || step !== 'upload' ? 'max-w-[min(100%,76rem)]' : 'max-w-[min(100%,48rem)]'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />

      <button
        type="button"
        onClick={() => navigate(`/enquiries/${id}`)}
        className="flex items-center gap-2 text-text-secondary min-h-11"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to enquiry
      </button>

      <div>
        <h2 className="text-2xl font-semibold">Import duct schedule</h2>
        <p className="text-text-secondary text-sm mt-1">
          {enquiry.enquiryNo} · {enquiry.projectName}
        </p>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      {step === 'upload' && (
        <Card className="space-y-5">
          <div className="flex flex-wrap gap-2 border-b border-border pb-4">
            <Button
              type="button"
              variant={importMode === 'file' ? 'primary' : 'secondary'}
              size="sm"
              disabled={parsingFile}
              onClick={openFilePicker}
            >
              <Upload className="w-4 h-4" />
              {parsingFile ? 'Reading Excel file…' : 'Upload Excel file'}
            </Button>
            <Button
              type="button"
              variant={importMode === 'paste' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setImportMode('paste')}
            >
              <Table2 className="w-4 h-4" />
              Paste in grid
            </Button>
          </div>

          <div className="text-sm text-text-secondary space-y-2">
            <p>
              {importMode === 'file'
                ? 'Upload your shop-drawing Excel (.xlsx, .xls, .csv) or ECOVENT template directly. Calculated columns (AREA Sq.m, 24G/22G/20G TDF, CORNNER, N/BOLT, CLEAT) and summary totals are computed automatically.'
                : 'Paste directly from Excel into the grid below, or type values cell by cell. Configure visible columns in Settings → Duct schedule import.'}
            </p>
            <p>
              <span className="font-medium text-text-primary">Required columns: </span>
              {requiredColumns.map((c) => c.header).join(', ')}.
            </p>
            {optionalColumns.length > 0 && (
              <p>
                <span className="font-medium text-text-primary">Optional: </span>
                {optionalColumns.map((c) => c.header).join(', ')}.
              </p>
            )}
          </div>

          <Button type="button" variant="secondary" onClick={() => exportDuctScheduleImportTemplate()}>
            <Download className="w-4 h-4" />
            Download Excel template
          </Button>

          {importMode === 'paste' && (
            <DuctSchedulePasteGrid
              columns={gridColumns}
              pivotColumns={pivotColumns}
              onContinue={onPasteGridContinue}
            />
          )}

          {importMode === 'file' && (
            <>
              {headerErrors.length > 0 && (
                <div className="rounded-lg border border-error/40 bg-error/5 p-4 space-y-2">
                  <p className="font-medium text-error text-sm">Column headers do not match the template</p>
                  <ul className="text-sm text-error list-disc pl-5 space-y-1">
                    {headerErrors.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openFilePicker()
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const f = e.dataTransfer.files?.[0]
                  if (f) void onFile(f)
                }}
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:bg-background"
              >
                <Upload className="w-10 h-10 text-primary" />
                <span className="font-medium">
                  {parsingFile
                    ? 'Reading Excel file…'
                    : 'Click or drag & drop Excel file (.xlsx, .xls, .csv)'}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={parsingFile}
                  onClick={(e) => {
                    e.stopPropagation()
                    openFilePicker()
                  }}
                >
                  Choose Excel file
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {step === 'review' && sheet && workbook && (
        <Card className="space-y-5">
          <div className="space-y-1">
            <p className="text-sm">
              <strong>{workbook.fileName}</strong> · sheet <strong>{sheet.name}</strong>
            </p>
            <p className="text-sm">
              <strong className="text-success">{summary.ready}</strong> duct line(s) ready to import
              {summary.attention > 0 && (
                <>
                  {' '}
                  · <strong className="text-error">{summary.attention}</strong> with errors (fix and try again)
                </>
              )}
            </p>
          </div>

          <DuctScheduleSummaryTable
            rows={ductSummary.rows}
            lineCount={normalizedRows.length}
            uniqueTags={uniqueTagCount}
            totalQty={ductSummary.totalQty}
          />

          <DuctScheduleLinesTable ductLines={normalizedRows} />

          <RowIssuesTable rows={rows} />

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              Back to import
            </Button>
            <Button onClick={handleConfirmImport} disabled={importing || summary.ready === 0}>
              {importing ? 'Importing…' : `Import ${summary.ready} row(s)`}
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && (
        <Card className="space-y-5 py-6">
          <div>
            <p className="text-lg font-semibold text-success">Import complete</p>
            <p className="text-sm text-text-secondary">
              Design extraction summary and totals were updated from your schedule.
            </p>
          </div>

          <DuctScheduleSummaryTable
            rows={ductSummary.rows}
            lineCount={normalizedRows.length}
            uniqueTags={uniqueTagCount}
            totalQty={ductSummary.totalQty}
          />

          <DuctScheduleLinesTable ductLines={normalizedRows} />

          <div>
            <Button onClick={() => navigate(`/enquiries/${id}`)}>Return to enquiry</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
