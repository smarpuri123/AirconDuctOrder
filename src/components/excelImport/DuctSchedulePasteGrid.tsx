import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { DuctScheduleColumnDef } from '@/lib/excelImport/ductScheduleColumnCatalog'
import {
  computeRowDerived,
  formatGridNumber,
  pivotTotals,
} from '@/lib/excelImport/gridCompute'
import type { DuctImportFieldKey } from '@/types/excelImport'
import {
  emptyGridRows,
  parseClipboardTable,
} from '@/lib/excelImport/gridSheet'

const DEFAULT_ROW_COUNT = 40

type Props = {
  columns: DuctScheduleColumnDef[]
  pivotColumns: DuctScheduleColumnDef[]
  onContinue: (dataRows: string[][]) => void
}

function recomputeRow(row: string[], columns: DuctScheduleColumnDef[]): string[] {
  const inputByKey: Partial<Record<DuctImportFieldKey, string>> = {}
  columns.forEach((col, i) => {
    if (col.role === 'input') inputByKey[col.fieldKey] = row[i] ?? ''
  })
  const derived = computeRowDerived(inputByKey)
  return columns.map((col, i) => {
    if (col.role === 'calculated') return derived[col.fieldKey] ?? ''
    return row[i] ?? ''
  })
}

export function DuctSchedulePasteGrid({ columns, pivotColumns, onContinue }: Props) {
  const colCount = columns.length
  const [rows, setRows] = useState(() => emptyGridRows(DEFAULT_ROW_COUNT, colCount))
  const [pasteHint, setPasteHint] = useState('')
  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    setRows((prev) => {
      const next = prev.map((r) => {
        const padded = [...r]
        while (padded.length < colCount) padded.push('')
        return recomputeRow(padded.slice(0, colCount), columns)
      })
      while (next.length < DEFAULT_ROW_COUNT) {
        next.push(Array(colCount).fill(''))
      }
      return next
    })
  }, [colCount, columns])

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      const col = columns[colIdx]
      if (!col || col.role !== 'input') return
      setRows((prev) => {
        const next = prev.map((r) => [...r])
        while (next.length <= rowIdx) {
          next.push(Array(colCount).fill(''))
        }
        next[rowIdx][colIdx] = value
        next[rowIdx] = recomputeRow(next[rowIdx], columns)
        return next
      })
    },
    [colCount, columns],
  )

  const applyPastedMatrix = useCallback(
    (matrix: string[][],
      startRow: number,
      startCol: number,
    ) => {
      setRows((prev) => {
        const next = prev.map((r) => [...r])
        for (let r = 0; r < matrix.length; r++) {
          const targetRow = startRow + r
          while (next.length <= targetRow) {
            next.push(Array(colCount).fill(''))
          }
          for (let c = 0; c < matrix[r].length; c++) {
            const targetCol = startCol + c
            if (targetCol >= colCount) break
            const col = columns[targetCol]
            if (col?.role !== 'input') continue
            next[targetRow][targetCol] = matrix[r][c] ?? ''
          }
          next[targetRow] = recomputeRow(next[targetRow], columns)
        }
        return next
      })
      setPasteHint(`Pasted ${matrix.length} row(s).`)
    },
    [colCount, columns],
  )

  const onPaste = useCallback(
    (e: React.ClipboardEvent, rowIdx: number, colIdx: number) => {
      const text = e.clipboardData.getData('text/plain')
      if (!text.includes('\t') && !text.includes('\n')) return
      e.preventDefault()
      const matrix = parseClipboardTable(text)
      if (matrix.length === 0) return
      applyPastedMatrix(matrix, rowIdx, colIdx)
    },
    [applyPastedMatrix],
  )

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const matrix = parseClipboardTable(text)
      if (matrix.length === 0) {
        setPasteHint('Clipboard is empty or not tabular data.')
        return
      }
      applyPastedMatrix(matrix, 0, 0)
    } catch {
      setPasteHint('Allow clipboard access, or click a cell and press Ctrl+V.')
    }
  }

  const addRows = () => {
    setRows((prev) => [...prev, ...emptyGridRows(10, colCount)])
  }

  const clearGrid = () => {
    setRows(emptyGridRows(DEFAULT_ROW_COUNT, colCount))
    setPasteHint('')
  }

  const dataRows = useMemo(
    () => rows.filter((r) => r.some((c) => String(c).trim() !== '')),
    [rows],
  )

  const filledRowCount = dataRows.length

  const pivotValues = useMemo(() => {
    const gridCols = columns.map((c) => ({ ...c, visible: true }))
    const totals = pivotTotals(dataRows, gridCols)
    return pivotColumns.map((col) => ({
      col,
      value: totals[col.fieldKey] ?? 0,
    }))
  }, [columns, dataRows, pivotColumns])

  const showSubHeader = columns.some((c) => c.subHeader)

  const handleContinue = () => {
    onContinue(dataRows)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Copy rows from Excel (Ctrl+C), then paste into the grid. Grey cells are calculated (area SFT and
        24G/22G/20G billing). Footer totals match pivot settings for accounts.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={handlePasteFromClipboard}>
          <ClipboardPaste className="w-4 h-4" />
          Paste from clipboard
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={addRows}>
          <Plus className="w-4 h-4" />
          Add 10 rows
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearGrid}>
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </div>

      {pasteHint && <p className="text-xs text-text-secondary">{pasteHint}</p>}

      <div className="overflow-auto border border-border rounded-lg max-h-[min(28rem,65vh)]">
        <table ref={tableRef} className="w-full text-sm border-collapse min-w-max">
          <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--color-border)]">
            {showSubHeader && (
              <tr>
                <th
                  className="p-1 border-b border-r border-border bg-background"
                  rowSpan={2}
                >
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={`${col.fieldKey}-main`}
                    className="p-2 text-left font-medium border-b border-r border-border whitespace-nowrap bg-background"
                  >
                    {col.subHeader ? col.header.replace(/\s*\(.*\)/, '') : col.header}
                    {col.required && <span className="text-error ml-0.5">*</span>}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {!showSubHeader && (
                <th className="p-1 w-10 text-center text-text-secondary font-normal border-b border-r border-border bg-background">
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.fieldKey}
                  className="p-2 text-left font-medium border-b border-r border-border whitespace-nowrap bg-background text-xs text-text-secondary"
                  title={col.role === 'calculated' ? 'Calculated' : col.required ? 'Required' : 'Input'}
                >
                  {showSubHeader ? (col.subHeader ?? '') : col.header}
                  {!showSubHeader && col.required && <span className="text-error ml-0.5">*</span>}
                  {col.role === 'calculated' && !showSubHeader && (
                    <span className="block text-[10px] font-normal">calc</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-background/80">
                <td className="p-1 text-center text-xs text-text-secondary border-r border-border tabular-nums">
                  {rowIdx + 1}
                </td>
                {columns.map((col, colIdx) => {
                  const readOnly = col.role !== 'input'
                  return (
                    <td key={col.fieldKey} className="p-0 border-r border-b border-border">
                      <input
                        type="text"
                        readOnly={readOnly}
                        className={`w-full min-w-[5.5rem] px-2 py-1.5 outline-none font-mono text-xs ${
                          readOnly
                            ? 'bg-muted/40 text-text-secondary cursor-default'
                            : 'bg-transparent focus:ring-2 focus:ring-inset focus:ring-primary/40'
                        }`}
                        value={row[colIdx] ?? ''}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                        onPaste={(e) => onPaste(e, rowIdx, colIdx)}
                        aria-label={`${col.header} row ${rowIdx + 1}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {pivotColumns.length > 0 && (
            <tfoot className="sticky bottom-0 bg-primary/5 border-t-2 border-primary/30">
              <tr>
                <td className="p-2 text-xs font-semibold border-r border-border">Σ</td>
                {columns.map((col) => {
                  const pivot = pivotValues.find((p) => {
                    if (col.fieldKey === 'corner') return p.col.fieldKey === 'pivotTotalCorner'
                    if (col.fieldKey === 'nBolt') return p.col.fieldKey === 'pivotTotalNBolt'
                    if (col.fieldKey === 'cleat') return p.col.fieldKey === 'pivotTotalCleat'
                    if (col.fieldKey === 'areaSqFt') return p.col.fieldKey === 'pivotTotalAreaSqFt'
                    if (col.fieldKey === 'sft24g') return p.col.fieldKey === 'pivotTotal24g'
                    if (col.fieldKey === 'sft22g') return p.col.fieldKey === 'pivotTotal22g'
                    if (col.fieldKey === 'sft20g') return p.col.fieldKey === 'pivotTotal20g'
                    return false
                  })
                  return (
                    <td
                      key={col.fieldKey}
                      className="p-2 text-right font-semibold tabular-nums text-xs border-r border-border"
                    >
                      {pivot ? formatGridNumber(pivot.value) : ''}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pivotColumns.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          {pivotValues.map(({ col, value }) => (
            <span key={col.fieldKey}>
              <span className="text-text-secondary">{col.header}:</span>{' '}
              <strong className="tabular-nums">{formatGridNumber(value)}</strong>
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-text-secondary">
        <strong className="text-text-primary">{filledRowCount}</strong> row(s) with data
      </p>

      <Button type="button" onClick={handleContinue} disabled={filledRowCount === 0}>
        Validate and review
      </Button>
    </div>
  )
}
