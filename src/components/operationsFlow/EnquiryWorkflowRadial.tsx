import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  EnquiryWorkflowBoard,
  EnquiryWorkflowRow,
  WorkflowStageCell,
} from '@/lib/operationsFlow/enquiryTrack'
import { annularSectorPath, openArcPath, polar } from '@/lib/operationsFlow/radial/geometry'
import {
  workshopSegmentFill,
  workshopSegmentStroke,
  ZONE_PALETTES,
  type WorkshopSegmentZone,
} from '@/lib/operationsFlow/radial/colors'
import {
  ARC_QUOTE_FAB_COLUMNS,
  arcSegmentAngles,
  columnBoundaryAngles,
  computeFanGeometry,
  computeLinearSegmentDots,
  DESIGN_HORIZONTAL_COLUMNS,
  horizontalDesignCellBounds,
  RADIAL_CATEGORY_GROUPS,
  radialGridLines,
  rowLabelAnchor,
  rowRadii,
  tangentialTextRotation,
  VERTICAL_DISPATCH_COLUMNS,
  verticalDispatchCellBounds,
  type RadialStageColumn,
} from '@/lib/operationsFlow/radial/workshopLayout'
import type { WorkflowPanelSelection } from './EnquiryWorkflowStagePanel'

type Props = {
  board: EnquiryWorkflowBoard
  onSelect: (selection: WorkflowPanelSelection) => void
}

function resolveColumnCell(row: EnquiryWorkflowRow, col: RadialStageColumn): WorkflowStageCell {
  if (col.key === 'dispatch_trips') {
    const tripCount = row.dispatches.length
    const readyCell = row.cells.find((c) => c.id === 'ready_dispatch')
    const qtySummary =
      row.totalOrderQty > 0
        ? `${row.dispatchedQty}/${row.totalOrderQty} dispatched (${row.pendingDispatchQty} pending)`
        : undefined
    return {
      id: 'ready_dispatch',
      label: 'Vehicle dispatch trips',
      shortLabel: 'Trips',
      kind: 'dispatch',
      layout: 'arc',
      status: row.dispatchSummaryStatus,
      detail:
        tripCount > 0
          ? `${tripCount} trip${tripCount === 1 ? '' : 's'}${qtySummary ? ` · ${qtySummary}` : ''}`
          : qtySummary ?? readyCell?.detail ?? 'No trips recorded yet',
    }
  }

  return (
    row.cells.find((c) => c.id === col.key) ?? {
      id: col.key,
      label: col.full,
      shortLabel: col.shortLines.join(' '),
      kind:
        col.zone === 'design'
          ? 'design'
          : col.zone === 'quote'
            ? 'accounts'
            : col.zone === 'production'
              ? 'production'
              : 'dispatch',
      layout: 'arc',
      status: 'pending',
    }
  )
}

type HoverTip = {
  x: number
  y: number
  title: string
  subtitle: string
  status: string
  detail?: string
}

export function EnquiryWorkflowRadial({ board, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rows = board.rows
  const rowCount = rows.length
  const [containerW, setContainerW] = useState(960)
  const geo = useMemo(() => computeFanGeometry(rowCount, containerW), [rowCount, containerW])
  const gridLines = useMemo(() => radialGridLines(geo), [geo])
  const [hover, setHover] = useState<HoverTip | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerW(Math.max(920, el.clientWidth)))
    ro.observe(el)
    setContainerW(Math.max(920, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const svgWidth = Math.max(geo.width, containerW)

  const ringBoundaries = useMemo(() => {
    const radii: number[] = []
    for (let i = 0; i <= Math.max(1, rowCount); i++) {
      radii.push(geo.baseInnerR + i * (geo.bandThickness + geo.bandGap))
    }
    return radii
  }, [geo, rowCount])

  const verticalYBoundaries = useMemo(() => {
    const ys: number[] = [geo.fanCy]
    let acc = geo.fanCy
    for (const h of geo.verticalRowHeights) {
      acc += h
      ys.push(acc)
    }
    return ys
  }, [geo])

  const handleCellClick = (
    row: EnquiryWorkflowRow,
    col: RadialStageColumn,
    cell: WorkflowStageCell,
  ) => {
    if (col.key === 'dispatch_trips' && row.dispatches.length > 0) {
      const latest = row.dispatches[row.dispatches.length - 1]
      onSelect({ type: 'dispatch', enquiryId: row.enquiryId, dispatchId: latest.id })
      return
    }
    onSelect({ type: 'stage', enquiryId: row.enquiryId, cell })
  }

  const handleRowLabelClick = (row: EnquiryWorkflowRow) => {
    const activeCell =
      (row.activeStageId ? row.cells.find((c) => c.id === row.activeStageId) : undefined) ??
      row.cells[0]
    if (activeCell) {
      onSelect({ type: 'stage', enquiryId: row.enquiryId, cell: activeCell })
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto rounded-xl border border-border bg-white shadow-xs"
    >
      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#f9faf9] px-4 py-2.5 text-xs text-gray-600">
        <div className="flex flex-wrap items-center gap-4">
          {RADIAL_CATEGORY_GROUPS.map((group) => {
            const palette = ZONE_PALETTES[group.zone]
            return (
              <span key={group.id} className="inline-flex items-center gap-1.5 font-medium">
                <span
                  className="inline-block h-3 w-3 rounded-xs"
                  style={{ backgroundColor: palette.completed }}
                />
                <span style={{ color: palette.headerText }}>{group.label}</span>
              </span>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-xs bg-[#659a24] px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className="h-1 w-1 rounded-full bg-white" />
            </span>
            Revisions (more dots = more revisions)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-xs bg-[#5c4d26] px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Dispatches (1 dot per trip)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-xs border border-gray-300 bg-white" />
            Pending
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-xs bg-[#d97706]" />
            On Hold / Revision
          </span>
        </div>
      </div>

      <svg
        width={svgWidth}
        height={geo.height}
        viewBox={`0 0 ${svgWidth} ${geo.height}`}
        className="block bg-white select-none"
        role="img"
        aria-label="Workshop radial order tracks"
      >
        {/* Base Track Backgrounds: Horizontal Design + 90° Arc + Vertical Down */}
        <rect
          x={geo.designStartX}
          y={geo.fanCy - geo.maxOuterR}
          width={geo.designSectionW}
          height={geo.maxOuterR - geo.baseInnerR}
          fill="#ffffff"
        />
        <path
          d={annularSectorPath(
            geo.fanCx,
            geo.fanCy,
            geo.baseInnerR,
            geo.maxOuterR,
            geo.arcStartDeg,
            geo.arcEndDeg,
          )}
          fill="#ffffff"
          stroke="none"
        />
        <rect
          x={geo.fanCx + geo.baseInnerR}
          y={geo.fanCy}
          width={geo.maxOuterR - geo.baseInnerR}
          height={geo.verticalSectionH}
          fill="#ffffff"
        />

        {/* Subtle row hover highlight across all 3 connected sections */}
        {rows.map((row, rowIndex) => {
          if (hoveredRowId !== row.enquiryId) return null
          const { innerR, outerR } = rowRadii(geo, rowIndex, rowCount)
          return (
            <g key={`highlight-${row.enquiryId}`} pointerEvents="none">
              <rect
                x={geo.designStartX}
                y={geo.fanCy - outerR}
                width={geo.designSectionW}
                height={outerR - innerR}
                fill="#f3f4f6"
              />
              <path
                d={annularSectorPath(
                  geo.fanCx,
                  geo.fanCy,
                  innerR,
                  outerR,
                  geo.arcStartDeg,
                  geo.arcEndDeg,
                )}
                fill="#f3f4f6"
              />
              <rect
                x={geo.fanCx + innerR}
                y={geo.fanCy}
                width={outerR - innerR}
                height={geo.verticalSectionH}
                fill="#f3f4f6"
              />
            </g>
          )
        })}

        {/* Track Cells: 1) Straight Horizontal Design, 2) 90° Arc Quote/Fab, 3) Straight Vertical Down Dispatch */}
        {rows.map((row, rowIndex) => {
          const { innerR, outerR } = rowRadii(geo, rowIndex, rowCount)
          const cellInnerR = innerR + 1.8
          const cellOuterR = Math.max(cellInnerR + 2, outerR - 1.8)
          const midR = (innerR + outerR) / 2

          return (
            <g key={`cells-${row.enquiryId}`}>
              {/* 1. Straight Horizontal Design Phase Cells */}
              {DESIGN_HORIZONTAL_COLUMNS.map((col, dIdx) => {
                const cell = resolveColumnCell(row, col)
                const b = horizontalDesignCellBounds(geo, rowIndex, rowCount, dIdx)
                const isFilled = cell.status !== 'pending'
                const fill = workshopSegmentFill(cell.status, col.zone as WorkshopSegmentZone)
                const stroke = workshopSegmentStroke(cell.status, col.zone as WorkshopSegmentZone)
                const isDesignExtraction = col.key === 'design_work'
                const revCount = isDesignExtraction
                  ? (cell.revisionCount ?? (isFilled ? row.revision : 0))
                  : 0
                const revDots = isDesignExtraction
                  ? computeLinearSegmentDots(
                      b.x + 4,
                      b.cy,
                      b.x + b.w - 4,
                      b.cy,
                      b.h,
                      revCount,
                    )
                  : []
                const dotFill = isFilled ? '#ffffff' : ZONE_PALETTES[col.zone].completed

                return (
                  <g
                    key={col.key}
                    className="cursor-pointer"
                    onClick={() => handleCellClick(row, col, cell)}
                    onMouseEnter={() => {
                      setHoveredRowId(row.enquiryId)
                      setHover({
                        x: b.cx,
                        y: b.y,
                        title: `${row.enquiryNo}${isDesignExtraction && row.revision > 1 ? ` · Rev ${String(row.revision).padStart(2, '0')}` : ''}`,
                        subtitle: col.full,
                        status: cell.status.replace('_', ' '),
                        detail:
                          isDesignExtraction && revCount > 0
                            ? `${revCount} revision${revCount === 1 ? '' : 's'}${cell.detail ? ` · ${cell.detail}` : ''}`
                            : cell.detail ?? cell.assigneeName,
                      })
                    }}
                    onMouseLeave={() => {
                      setHoveredRowId(null)
                      setHover(null)
                    }}
                  >
                    <rect
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      fill={isFilled ? fill : '#ffffff'}
                      fillOpacity={isFilled ? 1 : 0.01}
                      stroke={stroke}
                      strokeWidth={cell.status === 'active' ? 1.2 : 0}
                    />
                    {revDots.map((dot) => (
                      <circle
                        key={dot.index}
                        cx={dot.x}
                        cy={dot.y}
                        r={dot.r}
                        fill={dotFill}
                        opacity={0.95}
                        pointerEvents="none"
                      />
                    ))}
                  </g>
                )
              })}

              {/* 2. 90° Arc Quotation & Fabrication Cells */}
              {ARC_QUOTE_FAB_COLUMNS.map((col, aIdx) => {
                const cell = resolveColumnCell(row, col)
                const { start, end } = arcSegmentAngles(geo, aIdx)
                const midDeg = (start + end) / 2
                const [tipX, tipY] = polar(geo.fanCx, geo.fanCy, midR, midDeg)
                const pathD = annularSectorPath(
                  geo.fanCx,
                  geo.fanCy,
                  cellInnerR,
                  cellOuterR,
                  start,
                  end,
                )
                const isFilled = cell.status !== 'pending'
                const fill = workshopSegmentFill(cell.status, col.zone as WorkshopSegmentZone)
                const stroke = workshopSegmentStroke(cell.status, col.zone as WorkshopSegmentZone)

                return (
                  <g
                    key={col.key}
                    className="cursor-pointer"
                    onClick={() => handleCellClick(row, col, cell)}
                    onMouseEnter={() => {
                      setHoveredRowId(row.enquiryId)
                      setHover({
                        x: tipX,
                        y: tipY,
                        title: row.enquiryNo,
                        subtitle: col.full,
                        status: cell.status.replace('_', ' '),
                        detail: cell.detail ?? cell.assigneeName,
                      })
                    }}
                    onMouseLeave={() => {
                      setHoveredRowId(null)
                      setHover(null)
                    }}
                  >
                    <path
                      d={pathD}
                      fill={isFilled ? fill : '#ffffff'}
                      fillOpacity={isFilled ? 1 : 0.01}
                      stroke={stroke}
                      strokeWidth={cell.status === 'active' ? 1.2 : 0}
                    />
                  </g>
                )
              })}

              {/* 3. Straight Vertical Down Dispatch & Completion Cells */}
              {VERTICAL_DISPATCH_COLUMNS.map((col, vIdx) => {
                const cell = resolveColumnCell(row, col)
                const b = verticalDispatchCellBounds(geo, rowIndex, rowCount, vIdx)
                const isDispatchSegment = col.key === 'dispatch_trips'
                const dispatchCount = row.dispatches.length
                const isFilled = isDispatchSegment
                  ? dispatchCount > 0 || cell.status !== 'pending'
                  : cell.status !== 'pending'
                const fill = workshopSegmentFill(
                  isDispatchSegment && dispatchCount > 0 && cell.status === 'pending'
                    ? 'active'
                    : cell.status,
                  col.zone as WorkshopSegmentZone,
                )
                const stroke = workshopSegmentStroke(cell.status, col.zone as WorkshopSegmentZone)

                // Dots only appear on the dispatch_trips segment (1 dot per dispatch)
                const dotCount = isDispatchSegment ? dispatchCount : 0

                const vertDots = isDispatchSegment
                  ? computeLinearSegmentDots(
                      b.cx,
                      b.y + 5,
                      b.cx,
                      b.y + b.h - 5,
                      b.w,
                      dotCount,
                    )
                  : []
                const dotFill = isFilled ? '#ffffff' : ZONE_PALETTES[col.zone].completed

                return (
                  <g
                    key={col.key}
                    className="cursor-pointer"
                    onClick={() => handleCellClick(row, col, cell)}
                    onMouseEnter={() => {
                      setHoveredRowId(row.enquiryId)
                      setHover({
                        x: b.cx,
                        y: b.cy,
                        title: row.enquiryNo,
                        subtitle: col.full,
                        status: cell.status.replace('_', ' '),
                        detail: cell.detail,
                      })
                    }}
                    onMouseLeave={() => {
                      setHoveredRowId(null)
                      setHover(null)
                    }}
                  >
                    <rect
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      fill={isFilled ? fill : '#ffffff'}
                      fillOpacity={isFilled ? 1 : 0.01}
                      stroke={stroke}
                      strokeWidth={cell.status === 'active' ? 1.2 : 0}
                    />
                    {col.key === 'order_complete' &&
                      row.totalOrderQty > 0 &&
                      (row.dispatchedQty > 0 || Boolean(row.orderId)) && (
                        <text
                          x={b.cx}
                          y={b.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(-90 ${b.cx} ${b.cy})`}
                          fill={isFilled ? '#ffffff' : ZONE_PALETTES.dispatch.headerText}
                          className="font-mono text-[8.5px] font-bold pointer-events-none"
                        >
                          {`${row.dispatchedQty}/${row.totalOrderQty}`}
                        </text>
                      )}
                    {vertDots.map((dot) => {
                      const dispatchItem = isDispatchSegment ? row.dispatches[dot.index] : undefined
                      return (
                        <circle
                          key={dot.index}
                          cx={dot.x}
                          cy={dot.y}
                          r={dot.r}
                          fill={dotFill}
                          opacity={0.95}
                          className={dispatchItem ? 'cursor-pointer' : 'pointer-events-none'}
                          onClick={
                            dispatchItem
                              ? (e) => {
                                  e.stopPropagation()
                                  onSelect({
                                    type: 'dispatch',
                                    enquiryId: row.enquiryId,
                                    dispatchId: dispatchItem.id,
                                  })
                                }
                              : undefined
                          }
                          onMouseEnter={
                            dispatchItem
                              ? () => {
                                  setHoveredRowId(row.enquiryId)
                                  setHover({
                                    x: dot.x,
                                    y: dot.y,
                                    title: `${row.enquiryNo} · ${dispatchItem.dispatchNo}`,
                                    subtitle: `Trip #${dot.index + 1} (${dispatchItem.vehicleType})`,
                                    status: dispatchItem.status,
                                    detail:
                                      row.totalOrderQty > 0
                                        ? `Trip qty: ${dispatchItem.totalQuantity} · ${row.dispatchedQty}/${row.totalOrderQty} (${row.pendingDispatchQty} pending)`
                                        : `Qty: ${dispatchItem.totalQuantity}`,
                                  })
                                }
                              : undefined
                          }
                        />
                      )
                    })}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* Continuous Track Grid Lines across Horizontal -> 90° Arc -> Vertical Down */}
        {ringBoundaries.map((r, idx) => {
          const isOuterOrInner = idx === 0 || idx === ringBoundaries.length - 1
          const strokeColor = isOuterOrInner ? '#6b7280' : '#9ca3af'
          const strokeW = isOuterOrInner ? 1 : 0.75
          const yHoriz = geo.fanCy - r
          const xVert = geo.fanCx + r
          return (
            <g key={`track-grid-${idx}`} pointerEvents="none">
              {/* Horizontal section line */}
              <line
                x1={geo.designStartX}
                y1={yHoriz}
                x2={geo.fanCx}
                y2={yHoriz}
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
              {/* 90° Arc section line */}
              <path
                d={openArcPath(geo.fanCx, geo.fanCy, r, geo.arcStartDeg, geo.arcEndDeg)}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
              {/* Vertical-down section line */}
              <line
                x1={xVert}
                y1={geo.fanCy}
                x2={xVert}
                y2={geo.fanCy + geo.verticalSectionH}
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
            </g>
          )
        })}

        {/* Horizontal Design Section Vertical Column Dividers */}
        {Array.from({ length: DESIGN_HORIZONTAL_COLUMNS.length + 1 }, (_, i) => {
          const x = geo.designStartX + i * geo.designColW
          const isFirst = i === 0
          return (
            <line
              key={`design-divider-${i}`}
              x1={x}
              y1={geo.fanCy - geo.maxOuterR - geo.stageHeaderBandH}
              x2={x}
              y2={geo.fanCy - geo.baseInnerR}
              stroke={isFirst ? '#6b7280' : '#9ca3af'}
              strokeWidth={isFirst ? 1 : 0.75}
              pointerEvents="none"
            />
          )
        })}

        {/* 90° Arc Radial Spoke Dividers */}
        {gridLines.map((line) => (
          <line
            key={`spoke-${line.deg}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.isBoundary ? '#6b7280' : '#9ca3af'}
            strokeWidth={line.isBoundary ? 1 : 0.75}
            pointerEvents="none"
          />
        ))}

        {/* Vertical-Down Dispatch Section Horizontal Stage Dividers */}
        {verticalYBoundaries.map((y, i) => {
          const isLast = i === verticalYBoundaries.length - 1
          return (
            <line
              key={`vert-divider-${i}`}
              x1={geo.fanCx + geo.baseInnerR}
              y1={y}
              x2={geo.fanCx + geo.maxOuterR + geo.stageHeaderBandH}
              y2={y}
              stroke={isLast ? '#6b7280' : '#9ca3af'}
              strokeWidth={isLast ? 1 : 0.75}
              pointerEvents="none"
            />
          )
        })}

        {/* 1. Design Phase Header Band & Outer Bracket (Top Horizontal) */}
        {(() => {
          const palette = ZONE_PALETTES.design
          const x0 = geo.designStartX
          const x1 = geo.fanCx - 2
          const bracketY = geo.fanCy - geo.groupArcR
          const labelY = geo.fanCy - geo.groupLabelR
          const headerBandMidY = geo.fanCy - geo.maxOuterR - geo.stageHeaderBandH * 0.5

          return (
            <g pointerEvents="none">
              <line
                x1={x0}
                y1={bracketY}
                x2={x1}
                y2={bracketY}
                stroke={palette.arcStroke}
                strokeWidth={1.35}
              />
              <line
                x1={x0}
                y1={bracketY}
                x2={x0}
                y2={geo.fanCy - geo.maxOuterR - geo.stageHeaderBandH}
                stroke={palette.arcStroke}
                strokeWidth={1}
              />
              <line
                x1={x1}
                y1={bracketY}
                x2={x1}
                y2={geo.fanCy - geo.maxOuterR - geo.stageHeaderBandH}
                stroke={palette.arcStroke}
                strokeWidth={1}
              />
              <text
                x={(x0 + x1) / 2}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={palette.headerText}
                className="text-[12px] font-bold tracking-tight"
              >
                Design Phase
              </text>

              {DESIGN_HORIZONTAL_COLUMNS.map((col, idx) => {
                const cx = geo.designStartX + (idx + 0.5) * geo.designColW
                return (
                  <g key={`design-hdr-${col.key}`}>
                    <text
                      x={cx}
                      y={headerBandMidY - 5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={palette.headerText}
                      className="text-[9.5px] font-semibold"
                    >
                      {col.shortLines[0]}
                    </text>
                    <text
                      x={cx}
                      y={headerBandMidY + 6}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={palette.headerText}
                      className="text-[9.5px] font-semibold"
                    >
                      {col.shortLines[1]}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })()}

        {/* 2. Quotation & Fabrication Header Band & Outer Arcs (90° Arc) */}
        {RADIAL_CATEGORY_GROUPS.filter((g) => g.section === 'arc').map((group) => {
          const startBounds = columnBoundaryAngles(geo, group.arcStartIdx ?? 0)
          const endBounds = columnBoundaryAngles(geo, group.arcEndIdx ?? 0)
          const groupStart = startBounds.start + 0.4
          const groupEnd = endBounds.end - 0.4
          const groupMid = (startBounds.start + endBounds.end) / 2
          const palette = ZONE_PALETTES[group.zone]

          const arcD = openArcPath(geo.fanCx, geo.fanCy, geo.groupArcR, groupStart, groupEnd)
          const [gx, gy] = polar(geo.fanCx, geo.fanCy, geo.groupLabelR, groupMid)
          const gRot = tangentialTextRotation(groupMid)

          const [t1x1, t1y1] = polar(
            geo.fanCx,
            geo.fanCy,
            geo.maxOuterR + geo.stageHeaderBandH,
            startBounds.start,
          )
          const [t1x2, t1y2] = polar(geo.fanCx, geo.fanCy, geo.groupArcR, startBounds.start)
          const [t2x1, t2y1] = polar(
            geo.fanCx,
            geo.fanCy,
            geo.maxOuterR + geo.stageHeaderBandH,
            endBounds.end,
          )
          const [t2x2, t2y2] = polar(geo.fanCx, geo.fanCy, geo.groupArcR, endBounds.end)

          return (
            <g key={`group-${group.id}`} pointerEvents="none">
              <path d={arcD} fill="none" stroke={palette.arcStroke} strokeWidth={1.35} />
              <line
                x1={t1x1}
                y1={t1y1}
                x2={t1x2}
                y2={t1y2}
                stroke={palette.arcStroke}
                strokeWidth={1}
              />
              <line
                x1={t2x1}
                y1={t2y1}
                x2={t2x2}
                y2={t2y2}
                stroke={palette.arcStroke}
                strokeWidth={1}
              />
              <text
                x={gx}
                y={gy}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${gRot} ${gx} ${gy})`}
                fill={palette.headerText}
                className="text-[12px] font-bold tracking-tight"
              >
                {group.label}
              </text>
            </g>
          )
        })}

        {ARC_QUOTE_FAB_COLUMNS.map((col, aIdx) => {
          const { mid } = columnBoundaryAngles(geo, aIdx)
          const labelR = geo.maxOuterR + geo.stageHeaderBandH * 0.52
          const [lx, ly] = polar(geo.fanCx, geo.fanCy, labelR, mid)
          const rot = tangentialTextRotation(mid)
          const palette = ZONE_PALETTES[col.zone]

          return (
            <g
              key={`arc-label-${col.key}`}
              transform={`translate(${lx} ${ly}) rotate(${rot})`}
              pointerEvents="none"
            >
              <text
                x={0}
                y={-5}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={palette.headerText}
                className="text-[9px] font-semibold"
              >
                {col.shortLines[0]}
              </text>
              <text
                x={0}
                y={6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={palette.headerText}
                className="text-[9px] font-semibold"
              >
                {col.shortLines[1]}
              </text>
            </g>
          )
        })}

        {/* 3. Dispatch & Completion Header Band & Outer Bracket (Right Vertical Down) */}
        {(() => {
          const palette = ZONE_PALETTES.dispatch
          const y0 = geo.fanCy + 2
          const y1 = geo.fanCy + geo.verticalSectionH
          const bracketX = geo.fanCx + geo.groupArcR
          const labelX = geo.fanCx + geo.groupLabelR
          const headerBandMidX = geo.fanCx + geo.maxOuterR + geo.stageHeaderBandH * 0.5

          return (
            <g pointerEvents="none">
              <line
                x1={bracketX}
                y1={y0}
                x2={bracketX}
                y2={y1}
                stroke={palette.arcStroke}
                strokeWidth={1.35}
              />
              <line
                x1={geo.fanCx + geo.maxOuterR + geo.stageHeaderBandH}
                y1={y0}
                x2={bracketX}
                y2={y0}
                stroke={palette.arcStroke}
                strokeWidth={1}
              />
              <line
                x1={geo.fanCx + geo.maxOuterR + geo.stageHeaderBandH}
                y1={y1}
                x2={bracketX}
                y2={y1}
                stroke={palette.arcStroke}
                strokeWidth={1}
              />
              <text
                x={labelX}
                y={(y0 + y1) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(90 ${labelX} ${(y0 + y1) / 2})`}
                fill={palette.headerText}
                className="text-[12px] font-bold tracking-tight"
              >
                Dispatch & Completion
              </text>

              {VERTICAL_DISPATCH_COLUMNS.map((col, vIdx) => {
                const segY0 = verticalYBoundaries[vIdx]
                const segY1 = verticalYBoundaries[vIdx + 1]
                const cy = (segY0 + segY1) / 2
                return (
                  <g key={`vert-hdr-${col.key}`}>
                    <text
                      x={headerBandMidX}
                      y={cy - 5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={palette.headerText}
                      className="text-[9.5px] font-semibold"
                    >
                      {col.shortLines[0]}
                    </text>
                    <text
                      x={headerBandMidX}
                      y={cy + 6}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={palette.headerText}
                      className="text-[9.5px] font-semibold"
                    >
                      {col.shortLines[1]}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })()}

        {/* Left Row Labels Header: Only Enquiry Number */}
        <text
          x={geo.designStartX - 10}
          y={geo.fanCy - geo.maxOuterR - 14}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-gray-400 text-[11px] font-bold tracking-tight"
        >
          Enquiry No.
        </text>

        {/* Horizontal Enquiry Number Labels aligned to each track on the left */}
        {rows.map((row, rowIndex) => {
          const anchor = rowLabelAnchor(geo, rowIndex, rowCount)
          const isHovered = hoveredRowId === row.enquiryId
          const fontSize = geo.bandThickness <= 17 ? 'text-[9.5px]' : 'text-[10.5px]'

          return (
            <g
              key={`row-label-${row.enquiryId}`}
              className="cursor-pointer"
              onClick={() => handleRowLabelClick(row)}
              onMouseEnter={() => setHoveredRowId(row.enquiryId)}
              onMouseLeave={() => setHoveredRowId(null)}
            >
              <line
                x1={geo.designStartX - 6}
                y1={anchor.y}
                x2={geo.designStartX}
                y2={anchor.y}
                stroke={isHovered ? '#111827' : '#d1d5db'}
                strokeWidth={isHovered ? 1.4 : 0.8}
              />
              <text
                x={anchor.x}
                y={anchor.y}
                textAnchor="end"
                dominantBaseline="middle"
                className={`font-mono ${fontSize} ${
                  isHovered ? 'fill-gray-950 font-bold' : 'fill-gray-800 font-semibold'
                }`}
              >
                {row.enquiryNo}
              </text>
            </g>
          )
        })}

        {/* Floating Tooltip */}
        {hover && (
          <g pointerEvents="none">
            {(() => {
              const boxW = 224
              const lines = [
                hover.title,
                hover.subtitle,
                `Status: ${hover.status.toUpperCase()}`,
                hover.detail ? hover.detail : '',
              ].filter(Boolean)
              const boxH = lines.length * 15 + 14
              const tx = Math.min(Math.max(12, hover.x + 12), svgWidth - boxW - 12)
              const ty = Math.max(12, hover.y - boxH - 8)
              return (
                <>
                  <rect
                    x={tx}
                    y={ty}
                    width={boxW}
                    height={boxH}
                    rx={6}
                    fill="#111827"
                    opacity={0.94}
                  />
                  {lines.map((line, i) => (
                    <text
                      key={i}
                      x={tx + 10}
                      y={ty + 16 + i * 15}
                      className={
                        i === 0
                          ? 'fill-white text-[10.5px] font-bold font-mono'
                          : i === 1
                            ? 'fill-emerald-300 text-[10px] font-medium'
                            : 'fill-gray-200 text-[9.5px]'
                      }
                    >
                      {line.length > 36 ? `${line.slice(0, 35)}…` : line}
                    </text>
                  ))}
                </>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}
