import { Download } from 'lucide-react'
import { downloadEnquiryDocument } from '@/lib/enquiryDocuments'
import {
  shopDrawingCleat,
  shopDrawingCorner,
  shopDrawingNBolt,
  summarizeDuctScheduleLines,
  type DuctSummaryRowItem,
} from '@/lib/excelImport/shopDrawingCalc'
import type { EnquiryDesignDocument, EnquiryDuctLine } from '@/types/enquiry'

type Props = {
  enquiryId: string
  ductLines: EnquiryDuctLine[]
  ductScheduleDocuments: EnquiryDesignDocument[]
}

function formatNum(value: number | undefined, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return digits > 0 ? value.toFixed(digits) : String(value)
}

export function DuctScheduleSummaryTable({
  rows,
  lineCount,
  uniqueTags,
  totalQty,
}: {
  rows: DuctSummaryRowItem[]
  lineCount?: number
  uniqueTags?: number
  totalQty?: number
}) {
  return (
    <div className="space-y-2">
      {(lineCount !== undefined || uniqueTags !== undefined || totalQty !== undefined) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Duct schedule summary</p>
          <p className="text-xs text-text-secondary tabular-nums">
            {uniqueTags !== undefined ? `${uniqueTags} duct tag(s) · ` : ''}
            {lineCount !== undefined ? `${lineCount} line(s) · ` : ''}
            {totalQty !== undefined ? `${totalQty} total qty` : ''}
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full max-w-md border-collapse border border-border text-sm bg-white">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="border-r border-border px-4 py-2 text-center font-semibold text-text-primary" />
              <th className="border-r border-border px-4 py-2 text-center font-semibold text-text-primary">
                QTY
              </th>
              <th className="px-4 py-2 text-center font-semibold text-text-primary">
                UNITS
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.label} className="border-b border-border">
                <td className="border-r border-border px-4 py-2 text-center font-medium text-text-primary">
                  {item.label}
                </td>
                <td className="border-r border-border px-4 py-2 text-center font-semibold tabular-nums text-text-primary">
                  {item.qty}
                </td>
                <td className="px-4 py-2 text-center text-text-primary">
                  {item.units}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DuctScheduleLinesTable({
  ductLines,
}: {
  ductLines: Array<
    EnquiryDuctLine & {
      w1?: number
      h1?: number
      w2?: number
      h2?: number
      corner?: number
      nBolt?: number
      cleat?: number
    }
  >
}) {
  if (ductLines.length === 0) return null

  const totalQty = ductLines.reduce((s, l) => s + l.quantity, 0)
  const totalArea = ductLines.reduce((s, l) => s + (l.area ?? 0), 0)
  const uniqueTags = new Set(ductLines.map((l) => l.tagNo)).size
  const hasShopDims = ductLines.some(
    (l) => l.w1 !== undefined || l.h1 !== undefined || l.w2 !== undefined || l.h2 !== undefined,
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Imported ducts ({ductLines.length} lines)</p>
        <p className="text-xs text-text-secondary tabular-nums">
          {uniqueTags} duct(s) · {totalQty} qty · {formatNum(totalArea, 2)} SQ.MTR area
        </p>
      </div>
      <div className="overflow-auto border border-border rounded-lg max-h-[min(28rem,60vh)]">
        <table className="w-full text-sm min-w-[54rem]">
          <thead className="bg-background sticky top-0 z-10 border-b border-border">
            <tr className="text-left text-text-secondary">
              <th className="p-2 font-medium whitespace-nowrap">Duct No</th>
              <th className="p-2 font-medium whitespace-nowrap">Description</th>
              {hasShopDims ? (
                <>
                  <th className="p-2 font-medium whitespace-nowrap text-right">W1 (mm)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">H1 (mm)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">W2 (mm)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">H2 (mm)</th>
                </>
              ) : (
                <>
                  <th className="p-2 font-medium whitespace-nowrap text-right">DAI</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">W (mm)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">H (mm)</th>
                </>
              )}
              <th className="p-2 font-medium whitespace-nowrap text-right">L (mm)</th>
              <th className="p-2 font-medium whitespace-nowrap text-right">Qty</th>
              <th className="p-2 font-medium whitespace-nowrap text-right">Gauge</th>
              <th className="p-2 font-medium whitespace-nowrap text-right">Area (SQ.MTR)</th>
              <th className="p-2 font-medium whitespace-nowrap text-right">CORNER</th>
              <th className="p-2 font-medium whitespace-nowrap text-right">N/BOLT</th>
              <th className="p-2 font-medium whitespace-nowrap text-right">CLEAT</th>
            </tr>
          </thead>
          <tbody>
            {ductLines.map((line, idx) => {
              const corner = line.corner ?? shopDrawingCorner(line.quantity)
              const nBolt = line.nBolt ?? shopDrawingNBolt(corner)
              const cleat =
                line.cleat ??
                shopDrawingCleat(
                  line.w1 ?? line.width ?? 0,
                  line.h1 ?? line.height ?? 0,
                  line.w2 ?? (line.height > 0 ? line.width : 0),
                  line.h2 ?? line.height ?? 0,
                )

              return (
                <tr key={`${line.tagNo}-${idx}`} className="border-t border-border">
                  <td className="p-2 font-medium whitespace-nowrap">{line.tagNo}</td>
                  <td className="p-2 max-w-[12rem] truncate" title={line.description}>
                    {line.description || '—'}
                  </td>
                  {hasShopDims ? (
                    <>
                      <td className="p-2 text-right tabular-nums">{formatNum(line.w1 ?? line.width)}</td>
                      <td className="p-2 text-right tabular-nums">{formatNum(line.h1 ?? (line.height || undefined))}</td>
                      <td className="p-2 text-right tabular-nums">{formatNum(line.w2 ?? (line.height > 0 ? line.width : undefined))}</td>
                      <td className="p-2 text-right tabular-nums">{formatNum(line.h2 ?? (line.height || undefined))}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 text-right tabular-nums">{formatNum(line.dai)}</td>
                      <td className="p-2 text-right tabular-nums">{line.width}</td>
                      <td className="p-2 text-right tabular-nums">{line.height}</td>
                    </>
                  )}
                  <td className="p-2 text-right tabular-nums">{line.length}</td>
                  <td className="p-2 text-right tabular-nums">{line.quantity}</td>
                  <td className="p-2 text-right tabular-nums">
                    {line.gauge ? `${line.gauge}G` : '—'}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatNum(line.area, 2)}</td>
                  <td className="p-2 text-right tabular-nums">{formatNum(corner)}</td>
                  <td className="p-2 text-right tabular-nums">{formatNum(nBolt)}</td>
                  <td className="p-2 text-right tabular-nums">{formatNum(cleat, 2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DuctSchedulePanel({ enquiryId, ductLines, ductScheduleDocuments }: Props) {
  const hasDoc = ductScheduleDocuments.length > 0
  const hasLines = ductLines.length > 0
  if (!hasDoc && !hasLines) return null

  const summary = summarizeDuctScheduleLines(ductLines)
  const uniqueTags = new Set(ductLines.map((l) => l.tagNo)).size

  return (
    <div className="space-y-5">
      {hasDoc && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-2">
          <p className="text-sm font-medium">Schedule Excel file (Internal reference)</p>
          <p className="text-xs text-text-secondary">
            Internal duct schedule workbook uploaded during import (not shared with client). Line details and summary totals are shown below.
          </p>
          <ul className="space-y-2">
            {ductScheduleDocuments.map((doc, idx) => {
              const rev = doc.inputRevision && doc.inputRevision > 0 ? doc.inputRevision : ductScheduleDocuments.length - idx
              return (
                <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{doc.fileName}</span>
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      Rev {String(rev).padStart(2, '0')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-primary shrink-0 min-h-11 px-2"
                    onClick={() => downloadEnquiryDocument({ ...doc, enquiryId })}
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {hasLines && (
        <>
          <DuctScheduleSummaryTable
            rows={summary.rows}
            lineCount={ductLines.length}
            uniqueTags={uniqueTags}
            totalQty={summary.totalQty}
          />
          <DuctScheduleLinesTable ductLines={ductLines} />
        </>
      )}

      {hasDoc && !hasLines && (
        <p className="text-sm text-text-secondary">
          No duct lines were stored from the last import. Re-import using your Excel sheet.
        </p>
      )}
    </div>
  )
}
