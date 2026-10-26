import type { WorkflowStageId } from '../enquiryTrack'
import type { WorkshopSegmentZone } from './colors'
import { polar } from './geometry'

export type RadialStageColumnKey = WorkflowStageId | 'dispatch_trips'

export type TrackSectionKind = 'horizontal' | 'arc' | 'vertical'

export interface RadialStageColumn {
  key: RadialStageColumnKey
  shortLines: readonly [string] | readonly [string, string]
  full: string
  zone: Exclude<WorkshopSegmentZone, 'floor'>
  groupId: 'design' | 'quote' | 'production' | 'dispatch'
  section: TrackSectionKind
}

export const DESIGN_HORIZONTAL_COLUMNS: readonly RadialStageColumn[] = [
  {
    key: 'design_assignment',
    shortLines: ['Designer', 'Assign'],
    full: 'Designer assignment',
    zone: 'design',
    groupId: 'design',
    section: 'horizontal',
  },
  {
    key: 'design_work',
    shortLines: ['Design', 'Extraction'],
    full: 'Design extraction & schedule',
    zone: 'design',
    groupId: 'design',
    section: 'horizontal',
  },
  {
    key: 'design_handover',
    shortLines: ['Accounts', 'Handover'],
    full: 'Handover to accounts',
    zone: 'design',
    groupId: 'design',
    section: 'horizontal',
  },
] as const

export const ARC_QUOTE_FAB_COLUMNS: readonly RadialStageColumn[] = [
  {
    key: 'quotation_prep',
    shortLines: ['Quotation', 'Prep'],
    full: 'Quotation preparation',
    zone: 'quote',
    groupId: 'quote',
    section: 'arc',
  },
  {
    key: 'quotation_approval',
    shortLines: ['Quote', 'Review'],
    full: 'Quotation approval',
    zone: 'quote',
    groupId: 'quote',
    section: 'arc',
  },
  {
    key: 'quotation_submitted',
    shortLines: ['Submitted', 'to Client'],
    full: 'Quotation submitted to customer',
    zone: 'quote',
    groupId: 'quote',
    section: 'arc',
  },
  {
    key: 'customer_approval',
    shortLines: ['Customer', 'Approved'],
    full: 'Customer work approval',
    zone: 'quote',
    groupId: 'quote',
    section: 'arc',
  },
  {
    key: 'ready_production',
    shortLines: ['Ready for', 'Production'],
    full: 'Released to production floor',
    zone: 'production',
    groupId: 'production',
    section: 'arc',
  },
  {
    key: 'production_flat',
    shortLines: ['Straight', 'Ducts'],
    full: 'Flat (straight ducts) fabrication',
    zone: 'production',
    groupId: 'production',
    section: 'arc',
  },
  {
    key: 'production_plasma',
    shortLines: ['Plasma', 'Ducts'],
    full: 'Plasma CNC ducts fabrication',
    zone: 'production',
    groupId: 'production',
    section: 'arc',
  },
] as const

export const VERTICAL_DISPATCH_COLUMNS: readonly RadialStageColumn[] = [
  {
    key: 'ready_dispatch',
    shortLines: ['Ready for', 'Dispatch'],
    full: 'Ready for dispatch loading',
    zone: 'dispatch',
    groupId: 'dispatch',
    section: 'vertical',
  },
  {
    key: 'dispatch_trips',
    shortLines: ['Dispatch', 'Trips'],
    full: 'Vehicle dispatch trips (1 dot per dispatch)',
    zone: 'dispatch',
    groupId: 'dispatch',
    section: 'vertical',
  },
  {
    key: 'order_complete',
    shortLines: ['Order', 'Complete'],
    full: 'Order completed & delivered',
    zone: 'dispatch',
    groupId: 'dispatch',
    section: 'vertical',
  },
] as const

export const RADIAL_STAGE_COLUMNS: readonly RadialStageColumn[] = [
  ...DESIGN_HORIZONTAL_COLUMNS,
  ...ARC_QUOTE_FAB_COLUMNS,
  ...VERTICAL_DISPATCH_COLUMNS,
] as const

export interface RadialCategoryGroup {
  id: 'design' | 'quote' | 'production' | 'dispatch'
  label: string
  zone: Exclude<WorkshopSegmentZone, 'floor'>
  section: TrackSectionKind
  /** Indices within ARC_QUOTE_FAB_COLUMNS when section === 'arc' */
  arcStartIdx?: number
  arcEndIdx?: number
}

export const RADIAL_CATEGORY_GROUPS: readonly RadialCategoryGroup[] = [
  {
    id: 'design',
    label: 'Design Phase',
    zone: 'design',
    section: 'horizontal',
  },
  {
    id: 'quote',
    label: 'Quotation & Approval',
    zone: 'quote',
    section: 'arc',
    arcStartIdx: 0,
    arcEndIdx: 3,
  },
  {
    id: 'production',
    label: 'Fabrication',
    zone: 'production',
    section: 'arc',
    arcStartIdx: 4,
    arcEndIdx: 6,
  },
  {
    id: 'dispatch',
    label: 'Dispatch & Completion',
    zone: 'dispatch',
    section: 'vertical',
  },
] as const

export const STAGE_LEGEND = RADIAL_STAGE_COLUMNS.map((c) => ({
  short: c.shortLines.join(' '),
  full: c.full,
  zone: c.zone,
}))

export const ARC_STAGE_KEYS = ARC_QUOTE_FAB_COLUMNS.map((c) => c.key)

export type FanGeometry = {
  fanCx: number
  fanCy: number
  arcStartDeg: number
  arcEndDeg: number
  baseInnerR: number
  bandThickness: number
  bandGap: number
  labelColW: number
  designStartX: number
  designColW: number
  designSectionW: number
  verticalRowHeights: readonly [number, number, number]
  verticalSectionH: number
  stageHeaderBandH: number
  groupArcR: number
  groupLabelR: number
  padTop: number
  padRight: number
  padBottom: number
  padLeft: number
  maxOuterR: number
  arcSegmentCount: number
  segmentCount: number
  width: number
  height: number
}

/**
 * Hybrid J-track layout:
 * 1. Straight horizontal section (left -> fanCx) for Design phase
 * 2. 90° clockwise circular arc (-90° at 12 o'clock -> 0° at 3 o'clock) for Quotation & Fabrication
 * 3. Straight vertical-down section (fanCy -> fanCy + verticalSectionH) for Dispatch & Completion
 */
const ARC_START = -90
const ARC_END = 0

export function computeFanGeometry(rowCount: number, minWidth = 920): FanGeometry {
  const safeCount = Math.max(1, rowCount)

  const bandThickness =
    safeCount <= 4 ? 26 : safeCount <= 8 ? 22 : safeCount <= 14 ? 19 : 16
  const bandGap = 0
  // Larger inner radius ensures the 7 slices across the 90° arc are spacious and legible
  const baseInnerR =
    safeCount <= 4 ? 190 : safeCount <= 8 ? 175 : safeCount <= 14 ? 160 : 148

  const stageHeaderBandH = 56
  const groupArcGap = 6
  const groupLabelOffset = 18

  const maxOuterR = baseInnerR + safeCount * (bandThickness + bandGap)
  const groupArcR = maxOuterR + stageHeaderBandH + groupArcGap
  const groupLabelR = groupArcR + groupLabelOffset

  const labelColW = 136
  const designColW = 74
  const designSectionW = DESIGN_HORIZONTAL_COLUMNS.length * designColW
  const verticalRowHeights: readonly [number, number, number] = [62, 108, 62]
  const verticalSectionH =
    verticalRowHeights[0] + verticalRowHeights[1] + verticalRowHeights[2]

  const padTop = 24
  const padBottom = 20
  const padLeft = 28
  const padRight = 44

  const leftExtentFromCx = labelColW + designSectionW
  const rightExtentFromCx = groupLabelR + 28

  const naturalWidth = padLeft + leftExtentFromCx + rightExtentFromCx + padRight
  const width = Math.max(minWidth, naturalWidth)

  const extraW = Math.max(0, width - naturalWidth)
  const designStartX = padLeft + labelColW + extraW / 2
  const fanCx = designStartX + designSectionW
  const fanCy = padTop + groupLabelR + 12
  const height = fanCy + verticalSectionH + padBottom

  return {
    fanCx,
    fanCy,
    arcStartDeg: ARC_START,
    arcEndDeg: ARC_END,
    baseInnerR,
    bandThickness,
    bandGap,
    labelColW,
    designStartX,
    designColW,
    designSectionW,
    verticalRowHeights,
    verticalSectionH,
    stageHeaderBandH,
    groupArcR,
    groupLabelR,
    padTop,
    padRight,
    padBottom,
    padLeft,
    maxOuterR,
    arcSegmentCount: ARC_QUOTE_FAB_COLUMNS.length,
    segmentCount: RADIAL_STAGE_COLUMNS.length,
    width,
    height,
  }
}

/** Outermost track = rowIndex 0, innermost track = rowCount - 1. */
export function rowRadii(geo: FanGeometry, rowIndex: number, rowCount: number) {
  const safeCount = Math.max(1, rowCount)
  const slot = safeCount - 1 - rowIndex
  const innerR = geo.baseInnerR + slot * (geo.bandThickness + geo.bandGap)
  const outerR = innerR + geo.bandThickness
  return { innerR, outerR }
}

/** Horizontal cell bounds for a Design column (0..2) on row `rowIndex`. */
export function horizontalDesignCellBounds(
  geo: FanGeometry,
  rowIndex: number,
  rowCount: number,
  designColIdx: number,
): {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  colX0: number
  colX1: number
} {
  const { innerR, outerR } = rowRadii(geo, rowIndex, rowCount)
  const colX0 = geo.designStartX + designColIdx * geo.designColW
  const colX1 = colX0 + geo.designColW
  const xPad = 1.2
  const yPad = 1.8
  const x = colX0 + xPad
  const w = Math.max(4, geo.designColW - xPad * 2)
  const yTop = geo.fanCy - outerR + yPad
  const yBottom = geo.fanCy - innerR - yPad
  const h = Math.max(4, yBottom - yTop)
  return {
    x,
    y: yTop,
    w,
    h,
    cx: colX0 + geo.designColW / 2,
    cy: geo.fanCy - (innerR + outerR) / 2,
    colX0,
    colX1,
  }
}

/** Exact angular boundaries of an arc column (0..6 in ARC_QUOTE_FAB_COLUMNS). */
export function columnBoundaryAngles(
  geo: FanGeometry,
  arcSegmentIndex: number,
): { start: number; end: number; mid: number } {
  const span = geo.arcEndDeg - geo.arcStartDeg
  const step = span / geo.arcSegmentCount
  const start = geo.arcStartDeg + arcSegmentIndex * step
  const end = geo.arcStartDeg + (arcSegmentIndex + 1) * step
  return { start, end, mid: (start + end) / 2 }
}

/** Slightly inset cell angles for colored stage bars inside the 90° arc. */
export function arcSegmentAngles(
  geo: FanGeometry,
  arcSegmentIndex: number,
): { start: number; end: number } {
  const { start, end } = columnBoundaryAngles(geo, arcSegmentIndex)
  const pad = 0.28
  return {
    start: start + pad,
    end: end - pad,
  }
}

/** Vertical cell bounds for a Dispatch/Completion stage (0..2) on row `rowIndex`. */
export function verticalDispatchCellBounds(
  geo: FanGeometry,
  rowIndex: number,
  rowCount: number,
  verticalStageIdx: number,
): {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  segY0: number
  segY1: number
} {
  const { innerR, outerR } = rowRadii(geo, rowIndex, rowCount)
  let segY0 = geo.fanCy
  for (let i = 0; i < verticalStageIdx; i++) {
    segY0 += geo.verticalRowHeights[i]
  }
  const segH = geo.verticalRowHeights[verticalStageIdx] ?? 60
  const segY1 = segY0 + segH

  const xPad = 1.8
  const yPad = 1.2
  const x = geo.fanCx + innerR + xPad
  const w = Math.max(4, outerR - innerR - xPad * 2)
  const y = segY0 + yPad
  const h = Math.max(4, segH - yPad * 2)

  return {
    x,
    y,
    w,
    h,
    cx: geo.fanCx + (innerR + outerR) / 2,
    cy: segY0 + segH / 2,
    segY0,
    segY1,
  }
}

/**
 * Row label anchor at the left start of the horizontal Design track:
 * Only the enquiry number is displayed, aligned to y = fanCy - midR.
 */
export function rowLabelAnchor(
  geo: FanGeometry,
  rowIndex: number,
  rowCount: number,
): { x: number; y: number; midR: number } {
  const { innerR, outerR } = rowRadii(geo, rowIndex, rowCount)
  const midR = (innerR + outerR) / 2
  return {
    x: geo.designStartX - 10,
    y: geo.fanCy - midR,
    midR,
  }
}

/**
 * Returns an upright tangential rotation angle (in degrees) for text placed at polar angle `deg`.
 */
export function tangentialTextRotation(deg: number): number {
  let rot = deg + 90
  while (rot > 180) rot -= 360
  while (rot <= -180) rot += 360
  if (rot > 90) rot -= 180
  if (rot < -90) rot += 180
  return rot
}

export function radialGridLines(
  geo: FanGeometry,
): { deg: number; x1: number; y1: number; x2: number; y2: number; isBoundary: boolean }[] {
  const lines: { deg: number; x1: number; y1: number; x2: number; y2: number; isBoundary: boolean }[] = []
  const span = geo.arcEndDeg - geo.arcStartDeg
  for (let i = 0; i <= geo.arcSegmentCount; i++) {
    const deg = geo.arcStartDeg + (span * i) / geo.arcSegmentCount
    const [x1, y1] = polar(geo.fanCx, geo.fanCy, geo.baseInnerR, deg)
    const outerLimit = geo.maxOuterR + geo.stageHeaderBandH
    const [x2, y2] = polar(geo.fanCx, geo.fanCy, outerLimit, deg)
    lines.push({
      deg,
      x1,
      y1,
      x2,
      y2,
      isBoundary: i === 0 || i === geo.arcSegmentCount,
    })
  }
  return lines
}

export interface SegmentDot {
  x: number
  y: number
  r: number
  index: number
}

/**
 * Computes circular dot radius that shrinks smoothly as `count` increases,
 * bounded by both track thickness and available segment length.
 */
export function computeScaledDotRadius(
  count: number,
  bandThickness: number,
  segmentLength: number,
): number {
  if (count <= 0) return 0
  const baseR = Math.min(4.2, bandThickness * 0.24)
  const scale = 1 / Math.pow(count, 0.42)
  const maxByLen = (segmentLength * 0.78) / (count * 2.4)
  return Math.max(1.2, Math.min(baseR * scale, maxByLen))
}

/**
 * Places `count` circular dots along a straight segment from (x0, y0) to (x1, y1).
 * More dots appear with reduced sizes as `count` increases.
 */
export function computeLinearSegmentDots(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bandThickness: number,
  count: number,
): SegmentDot[] {
  if (count <= 0) return []
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len <= 0) return []

  const r = computeScaledDotRadius(count, bandThickness, len)
  const midX = (x0 + x1) / 2
  const midY = (y0 + y1) / 2

  if (count === 1) {
    return [{ x: midX, y: midY, r, index: 0 }]
  }

  const ux = dx / len
  const uy = dy / len
  const pitch = Math.min(r * 2.65, (len * 0.74) / (count - 1))
  const totalSpan = pitch * (count - 1)
  const startOffset = -totalSpan / 2

  return Array.from({ length: count }, (_, i) => {
    const offset = startOffset + i * pitch
    return {
      x: midX + ux * offset,
      y: midY + uy * offset,
      r,
      index: i,
    }
  })
}

/**
 * Places `count` circular dots along an arc segment's midline radius `midR`
 * between `startDeg` and `endDeg`. More dots appear with reduced sizes as `count` increases.
 */
export function computeArcSegmentDots(
  cx: number,
  cy: number,
  midR: number,
  startDeg: number,
  endDeg: number,
  bandThickness: number,
  count: number,
): SegmentDot[] {
  if (count <= 0) return []
  const spanDeg = Math.abs(endDeg - startDeg)
  const arcLen = midR * ((spanDeg * Math.PI) / 180)
  const r = computeScaledDotRadius(count, bandThickness, arcLen)
  const midDeg = (startDeg + endDeg) / 2

  if (count === 1) {
    const [x, y] = polar(cx, cy, midR, midDeg)
    return [{ x, y, r, index: 0 }]
  }

  const maxLinearPitch = Math.min(r * 2.65, (arcLen * 0.74) / (count - 1))
  const pitchDeg = (maxLinearPitch / midR) * (180 / Math.PI)
  const totalSpanDeg = pitchDeg * (count - 1)
  const firstDeg = midDeg - totalSpanDeg / 2

  return Array.from({ length: count }, (_, i) => {
    const deg = firstDeg + i * pitchDeg
    const [x, y] = polar(cx, cy, midR, deg)
    return { x, y, r, index: i }
  })
}
