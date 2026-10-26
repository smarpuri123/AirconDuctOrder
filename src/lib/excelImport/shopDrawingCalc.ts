import type { EnquiryDuctLine } from '@/types/enquiry'

/** Matches shop-drawing Excel: (((W1+H1+W2+H2)*L)/92903.04)/10.76 * QTY → AREA Sq.m */
export const SHOP_AREA_MM_FACTOR = 92903.04
export const SHOP_SQM_TO_SFT = 10.76

export type GaugeBand = '24g' | '22g' | '20g'

export function parseImportNumber(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

export function maxFaceMm(
  w1?: number,
  h1?: number,
  w2?: number,
  h2?: number,
): number {
  const dims = [w1, h1, w2, h2].filter((d) => d !== undefined && d > 0) as number[]
  return dims.length ? Math.max(...dims) : 0
}

export function gaugeBandFromMaxFace(maxFaceMm: number): GaugeBand | null {
  if (maxFaceMm <= 0) return null
  if (maxFaceMm <= 750) return '24g'
  if (maxFaceMm <= 1500) return '22g'
  return '20g'
}

export function gaugeNumberFromBand(band: GaugeBand | null): number | undefined {
  if (band === '24g') return 24
  if (band === '22g') return 22
  if (band === '20g') return 20
  return undefined
}

/** Area in Sq.m for one line (includes quantity): (((W1+H1+W2+H2)*L)/92903.04)/10.76 * QTY */
export function shopDrawingAreaSqFt(
  w1: number,
  h1: number,
  w2: number,
  h2: number,
  lengthMm: number,
  quantity: number,
): number {
  const perimeter = w1 + h1 + w2 + h2
  if (perimeter <= 0 || lengthMm <= 0 || quantity <= 0) return 0
  const perPiece =
    (perimeter * lengthMm) / SHOP_AREA_MM_FACTOR / SHOP_SQM_TO_SFT
  return perPiece * quantity
}

/** CORNER = QTY * 8 */
export function shopDrawingCorner(quantity: number): number {
  return quantity > 0 ? quantity * 8 : 0
}

/** N/BOLT = CORNER / 2 */
export function shopDrawingNBolt(corner: number): number {
  return corner > 0 ? corner / 2 : 0
}

/** CLEAT = (((W1 + H1 + W2 + H2) * 350) / 100000) */
export function shopDrawingCleat(
  w1: number,
  h1: number,
  w2: number,
  h2: number,
): number {
  const perimeter = w1 + h1 + w2 + h2
  if (perimeter <= 0) return 0
  return (perimeter * 350) / 100000
}

export function allocateGaugeSqFt(
  totalSqFt: number,
  band: GaugeBand | null,
): { sft24g: number; sft22g: number; sft20g: number } {
  if (!band || totalSqFt <= 0) {
    return { sft24g: 0, sft22g: 0, sft20g: 0 }
  }
  if (band === '24g') return { sft24g: totalSqFt, sft22g: 0, sft20g: 0 }
  if (band === '22g') return { sft24g: 0, sft22g: totalSqFt, sft20g: 0 }
  return { sft24g: 0, sft22g: 0, sft20g: totalSqFt }
}

export interface ShopDrawingDerived {
  areaSqFt: number
  sft24g: number
  sft22g: number
  sft20g: number
  corner: number
  nBolt: number
  cleat: number
  maxFaceMm: number
  band: GaugeBand | null
}

export function deriveShopDrawingRow(
  w1?: number,
  h1?: number,
  w2?: number,
  h2?: number,
  lengthMm?: number,
  quantity?: number,
): ShopDrawingDerived {
  const w = w1 ?? 0
  const h = h1 ?? 0
  const w2v = w2 ?? 0
  const h2v = h2 ?? 0
  const len = lengthMm ?? 0
  const qty = quantity ?? 0
  const maxFace = maxFaceMm(w, h, w2v, h2v)
  const areaSqFt = shopDrawingAreaSqFt(w, h, w2v, h2v, len, qty)
  const band = gaugeBandFromMaxFace(maxFace)
  const buckets = allocateGaugeSqFt(areaSqFt, band)
  const corner = shopDrawingCorner(qty)
  const nBolt = shopDrawingNBolt(corner)
  const cleat = shopDrawingCleat(w, h, w2v, h2v)
  return {
    areaSqFt,
    ...buckets,
    corner,
    nBolt,
    cleat,
    maxFaceMm: maxFace,
    band,
  }
}

export interface DuctSummaryRowItem {
  label: string
  qty: string
  rawQty: number
  units: string
}

export interface DuctScheduleSummaryTotals {
  corner: number
  nBolt: number
  cleat: number
  gasket: number
  tdf24g: number
  tdf22g: number
  tdf20g: number
  totalQty: number
  totalArea: number
  rows: DuctSummaryRowItem[]
}

/**
 * Computes the 7-row summary table (CORNNER, N/BOLT, CLEAT, GASKET, 24G TDF, 22G TDF, 20G TDF)
 * from imported duct lines.
 */
export function summarizeDuctScheduleLines(
  lines: Array<
    Pick<
      EnquiryDuctLine,
      'width' | 'height' | 'length' | 'quantity' | 'area' | 'gauge' | 'rmt'
    > & {
      w1?: number
      h1?: number
      w2?: number
      h2?: number
      corner?: number
      nBolt?: number
      cleat?: number
      sft24g?: number
      sft22g?: number
      sft20g?: number
    }
  >,
): DuctScheduleSummaryTotals {
  let corner = 0
  let nBolt = 0
  let cleat = 0
  let tdf24g = 0
  let tdf22g = 0
  let tdf20g = 0
  let totalQty = 0
  let totalArea = 0

  for (const line of lines) {
    const qty = line.quantity ?? 0
    totalQty += qty

    const lineCorner = line.corner ?? shopDrawingCorner(qty)
    const lineNBolt = line.nBolt ?? shopDrawingNBolt(lineCorner)

    // rmt stores cleat when persisted via the standard EnquiryDuctLine schema
    const hasExplicitW12 =
      line.w1 !== undefined ||
      line.h1 !== undefined ||
      line.w2 !== undefined ||
      line.h2 !== undefined
    const fallbackCleat = hasExplicitW12
      ? shopDrawingCleat(line.w1 ?? 0, line.h1 ?? 0, line.w2 ?? 0, line.h2 ?? 0)
      : shopDrawingCleat(
          line.width ?? 0,
          line.height ?? 0,
          line.height > 0 ? (line.width ?? 0) : 0,
          line.height ?? 0,
        )
    const lineCleat = line.rmt ?? line.cleat ?? fallbackCleat

    corner += lineCorner
    nBolt += lineNBolt
    cleat += lineCleat

    const lineArea = line.area ?? 0
    totalArea += lineArea

    if (
      line.sft24g !== undefined ||
      line.sft22g !== undefined ||
      line.sft20g !== undefined
    ) {
      tdf24g += line.sft24g ?? 0
      tdf22g += line.sft22g ?? 0
      tdf20g += line.sft20g ?? 0
    } else if (line.gauge === 24) {
      tdf24g += lineArea
    } else if (line.gauge === 22) {
      tdf22g += lineArea
    } else if (line.gauge === 20) {
      tdf20g += lineArea
    } else {
      const mf = hasExplicitW12
        ? maxFaceMm(line.w1, line.h1, line.w2, line.h2)
        : maxFaceMm(line.width, line.height)
      const band = gaugeBandFromMaxFace(mf)
      const buckets = allocateGaugeSqFt(lineArea, band)
      tdf24g += buckets.sft24g
      tdf22g += buckets.sft22g
      tdf20g += buckets.sft20g
    }
  }

  const fmtInt = (v: number) => (v > 0 ? String(Math.round(v)) : '')
  const fmtSqm = (v: number) => (v > 1e-6 ? (Math.round(v * 100) / 100).toFixed(2) : '')

  const rows: DuctSummaryRowItem[] = [
    { label: 'CORNNER', qty: fmtInt(corner), rawQty: Math.round(corner), units: 'NOS' },
    { label: 'N/BOLT', qty: fmtInt(nBolt), rawQty: Math.round(nBolt), units: 'NOS' },
    { label: 'CLEAT', qty: fmtInt(cleat), rawQty: Math.round(cleat), units: 'NOS' },
    { label: 'GASKET', qty: '', rawQty: 0, units: 'ROLLS' },
    { label: '24G TDF', qty: fmtSqm(tdf24g), rawQty: tdf24g, units: 'SQ.MTR' },
    { label: '22G TDF', qty: fmtSqm(tdf22g), rawQty: tdf22g, units: 'SQ.MTR' },
    { label: '20G TDF', qty: fmtSqm(tdf20g), rawQty: tdf20g, units: 'SQ.MTR' },
  ]

  return {
    corner: Math.round(corner),
    nBolt: Math.round(nBolt),
    cleat: Math.round(cleat),
    gasket: 0,
    tdf24g,
    tdf22g,
    tdf20g,
    totalQty,
    totalArea,
    rows,
  }
}
