import { Download } from 'lucide-react'
import { downloadEnquiryDocument } from '@/lib/enquiryDocuments'
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

export function DuctSchedulePanel({ enquiryId, ductLines, ductScheduleDocuments }: Props) {
  const hasDoc = ductScheduleDocuments.length > 0
  const hasLines = ductLines.length > 0
  if (!hasDoc && !hasLines) return null

  const totalQty = ductLines.reduce((s, l) => s + l.quantity, 0)
  const totalArea = ductLines.reduce((s, l) => s + (l.area ?? 0), 0)
  const uniqueTags = new Set(ductLines.map((l) => l.tagNo)).size

  return (
    <div className="space-y-4">
      {hasDoc && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-2">
          <p className="text-sm font-medium">Schedule Excel file</p>
          <p className="text-xs text-text-secondary">
            Download the workbook uploaded during import. Line details are listed in the table below.
          </p>
          <ul className="space-y-2">
            {ductScheduleDocuments.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{doc.fileName}</span>
                <button
                  type="button"
                  className="flex items-center gap-1 text-primary shrink-0 min-h-11 px-2"
                  onClick={() => downloadEnquiryDocument({ ...doc, enquiryId })}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasLines && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Imported tags ({ductLines.length} lines)</p>
            <p className="text-xs text-text-secondary tabular-nums">
              {uniqueTags} tag(s) · {totalQty} qty · {formatNum(totalArea, 2)} m² area
            </p>
          </div>
          <div className="overflow-auto border border-border rounded-lg max-h-[min(28rem,60vh)]">
            <table className="w-full text-sm min-w-[48rem]">
              <thead className="bg-background sticky top-0 z-10 border-b border-border">
                <tr className="text-left text-text-secondary">
                  <th className="p-2 font-medium whitespace-nowrap">Tag No</th>
                  <th className="p-2 font-medium whitespace-nowrap">Description</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">DAI</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">W (mm)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">H (mm)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">L (mm)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">Qty</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">Gauge</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">Area (m²)</th>
                  <th className="p-2 font-medium whitespace-nowrap text-right">RMT</th>
                </tr>
              </thead>
              <tbody>
                {ductLines.map((line, idx) => (
                  <tr key={`${line.tagNo}-${idx}`} className="border-t border-border">
                    <td className="p-2 font-medium whitespace-nowrap">{line.tagNo}</td>
                    <td className="p-2 max-w-[12rem] truncate" title={line.description}>
                      {line.description || '—'}
                    </td>
                    <td className="p-2 text-right tabular-nums">{formatNum(line.dai)}</td>
                    <td className="p-2 text-right tabular-nums">{line.width}</td>
                    <td className="p-2 text-right tabular-nums">{line.height}</td>
                    <td className="p-2 text-right tabular-nums">{line.length}</td>
                    <td className="p-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="p-2 text-right tabular-nums">{formatNum(line.gauge)}</td>
                    <td className="p-2 text-right tabular-nums">{formatNum(line.area, 2)}</td>
                    <td className="p-2 text-right tabular-nums">{formatNum(line.rmt, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasDoc && !hasLines && (
        <p className="text-sm text-text-secondary">
          No duct lines were stored from the last import. Re-import using the ECOVENT template.
        </p>
      )}
    </div>
  )
}
