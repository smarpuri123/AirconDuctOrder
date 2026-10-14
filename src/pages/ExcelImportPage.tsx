import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { enquiryService } from '@/services/enquiryService'
import { exportDuctScheduleImportTemplate } from '@/lib/excelExport'
import { getCurrentUser } from '@/lib/currentUser'
import { parseExcelFile } from '@/lib/excelImport/parser'
import {
  buildCanonicalMappings,
  DUCT_SCHEDULE_CANONICAL_COLUMNS,
  validateDuctScheduleHeaders,
} from '@/lib/excelImport/canonicalTemplate'
import {
  buildImportRows,
  normalizeRow,
  summarizeImport,
} from '@/lib/excelImport/transform'
import { applyDuplicateErrors } from '@/lib/excelImport/validate'
import { saveImportAudit } from '@/lib/excelImport/audit'
import { filesToPayloadsWithProgress } from '@/lib/enquiryDocuments'
import type { ExcelImportStep, ImportRowDraft, ParsedSheet, ParsedWorkbook } from '@/types/excelImport'

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
            <th className="p-2 text-left font-medium">Tag No</th>
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

  const [step, setStep] = useState<ExcelImportStep>('upload')
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [rows, setRows] = useState<ImportRowDraft[]>([])
  const [headerErrors, setHeaderErrors] = useState<string[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [sourceFile, setSourceFile] = useState<File | null>(null)

  const sheet: ParsedSheet | undefined = workbook?.sheets[sheetIndex]

  const summary = useMemo(() => summarizeImport(rows), [rows])

  const buildRowsFromSheet = useCallback((sh: ParsedSheet) => {
    const mappings = buildCanonicalMappings(sh)
    const built = buildImportRows(sh, mappings, sh.dataRowIndices)
    return applyDuplicateErrors(built)
  }, [])

  const onFile = async (file: File) => {
    setError('')
    setHeaderErrors([])
    try {
      const wb = await parseExcelFile(file)
      setSourceFile(file)
      setWorkbook(wb)
      setSheetIndex(0)
      const sh = wb.sheets[0]
      const columnErrors = validateDuctScheduleHeaders(sh.headers)
      if (columnErrors.length > 0) {
        setHeaderErrors(columnErrors)
        setRows([])
        setStep('upload')
        return
      }
      setRows(buildRowsFromSheet(sh))
      setStep('review')
    } catch {
      setError('Could not read this Excel file.')
    }
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

      const user = getCurrentUser()
      saveImportAudit({
        id: `imp_${Date.now()}`,
        enquiryId: id,
        fileName: workbook.fileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.name,
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

  const requiredColumns = DUCT_SCHEDULE_CANONICAL_COLUMNS.filter((c) => c.required)
  const optionalColumns = DUCT_SCHEDULE_CANONICAL_COLUMNS.filter((c) => !c.required)

  if (!enquiry) {
    return <p className="text-text-secondary p-6">Enquiry not found.</p>
  }

  return (
    <div className="max-w-[min(100%,48rem)] mx-auto space-y-6 pb-12 px-2 sm:px-0">
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
          <div className="text-sm text-text-secondary space-y-2">
            <p>
              Use the ECOVENT Excel template with fixed column names. We validate the header row, then
              import every data row — no column mapping step.
            </p>
            <p>
              <span className="font-medium text-text-primary">Required columns: </span>
              {requiredColumns.map((c) => c.header).join(', ')}.
            </p>
            <p>
              <span className="font-medium text-text-primary">Optional: </span>
              {optionalColumns.map((c) => c.header).join(', ')}.
            </p>
          </div>

          <Button type="button" variant="secondary" onClick={() => exportDuctScheduleImportTemplate()}>
            <Download className="w-4 h-4" />
            Download Excel template
          </Button>

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

          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:bg-background">
            <Upload className="w-10 h-10 text-primary" />
            <span className="font-medium">Browse and select Excel (.xlsx, .xls)</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
          </label>
        </Card>
      )}

      {step === 'review' && sheet && workbook && (
        <Card className="space-y-4">
          <p className="text-sm">
            <strong>{workbook.fileName}</strong> · sheet <strong>{sheet.name}</strong> ·{' '}
            <strong>{sheet.dataRowIndices.length}</strong> data row(s)
          </p>
          <p className="text-sm">
            <strong className="text-success">{summary.ready}</strong> ready to import
            {summary.attention > 0 && (
              <>
                {' '}
                · <strong className="text-error">{summary.attention}</strong> with errors (fix in Excel and
                re-upload)
              </>
            )}
          </p>

          <RowIssuesTable rows={rows} />

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              Choose another file
            </Button>
            <Button onClick={handleConfirmImport} disabled={importing || summary.ready === 0}>
              {importing ? 'Importing…' : `Import ${summary.ready} row(s)`}
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && (
        <Card className="space-y-4 text-center py-8">
          <p className="text-lg font-semibold text-success">Import complete</p>
          <p className="text-sm text-text-secondary">Design extraction totals were updated from your schedule.</p>
          <Button onClick={() => navigate(`/enquiries/${id}`)}>Return to enquiry</Button>
        </Card>
      )}
    </div>
  )
}
