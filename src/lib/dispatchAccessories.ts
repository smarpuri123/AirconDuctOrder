import {
  shopDrawingCleat,
  shopDrawingCorner,
  shopDrawingNBolt,
  summarizeDuctScheduleLines,
} from '@/lib/excelImport/shopDrawingCalc'
import type {
  Dispatch,
  DispatchAccessories,
  DispatchAccessoryMode,
  Order,
} from '@/types'
import type { EnquiryDuctLine } from '@/types/enquiry'

export function calculateDispatchAccessories(
  order: Order,
  quantities: Record<string, number>,
  mode: DispatchAccessoryMode,
  ductLines?: EnquiryDuctLine[],
  existingIncluded?: { corner: boolean; nBolt: boolean; cleat: boolean },
): DispatchAccessories {
  const inc = existingIncluded ?? { corner: true, nBolt: true, cleat: true }

  if (mode === 'entire_batch') {
    if (ductLines && ductLines.length > 0) {
      const totals = summarizeDuctScheduleLines(ductLines)
      return {
        mode,
        corner: { quantity: totals.corner, included: inc.corner },
        nBolt: { quantity: totals.nBolt, included: inc.nBolt },
        cleat: { quantity: totals.cleat, included: inc.cleat },
      }
    }
    let corner = 0
    let nBolt = 0
    let cleat = 0
    for (const item of order.items) {
      const qty = item.orderedQty
      const c = shopDrawingCorner(qty)
      corner += c
      nBolt += shopDrawingNBolt(c)
      cleat += shopDrawingCleat(item.w1, item.h1, item.w2, item.h2)
    }
    return {
      mode,
      corner: { quantity: Math.round(corner), included: inc.corner },
      nBolt: { quantity: Math.round(nBolt), included: inc.nBolt },
      cleat: { quantity: Math.round(cleat), included: inc.cleat },
    }
  }

  // Per trip: only the ducts loaded in this dispatch trip
  let corner = 0
  let nBolt = 0
  let cleat = 0
  const lineByTag = new Map(
    (ductLines ?? []).map((l) => [String(l.tagNo).trim(), l]),
  )

  for (const item of order.items) {
    const qty = quantities[item.id] ?? 0
    if (qty <= 0) continue

    const c = shopDrawingCorner(qty)
    corner += c
    nBolt += shopDrawingNBolt(c)

    const matchedLine = lineByTag.get(String(item.tagNo).trim())
    const fullLineCleat =
      matchedLine?.rmt ?? shopDrawingCleat(item.w1, item.h1, item.w2, item.h2)
    const ratio = item.orderedQty > 0 ? qty / item.orderedQty : 1
    cleat += fullLineCleat * ratio
  }

  return {
    mode,
    corner: { quantity: Math.round(corner), included: inc.corner },
    nBolt: { quantity: Math.round(nBolt), included: inc.nBolt },
    cleat: { quantity: Math.round(cleat), included: inc.cleat },
  }
}

export function resolveDispatchAccessories(
  dispatch: Dispatch,
  order?: Order,
  ductLines?: EnquiryDuctLine[],
): DispatchAccessories {
  if (dispatch.accessories) return dispatch.accessories

  // Fallback calculation for dispatches created before accessories metadata was stored
  let corner = 0
  let nBolt = 0
  let cleat = 0
  const lineByTag = new Map(
    (ductLines ?? []).map((l) => [String(l.tagNo).trim(), l]),
  )
  const orderItemById = new Map((order?.items ?? []).map((i) => [i.id, i]))

  for (const item of dispatch.items) {
    const qty = item.quantity
    if (qty <= 0) continue
    const c = shopDrawingCorner(qty)
    corner += c
    nBolt += shopDrawingNBolt(c)

    const matchedLine = lineByTag.get(String(item.tagNo).trim())
    const orderItem = orderItemById.get(item.orderItemId)
    const fullLineCleat =
      matchedLine?.rmt ?? shopDrawingCleat(item.w1, item.h1, item.w2, item.h2)
    const orderedQty = orderItem?.orderedQty ?? qty
    const ratio = orderedQty > 0 ? qty / orderedQty : 1
    cleat += fullLineCleat * ratio
  }

  return {
    mode: 'per_trip',
    corner: { quantity: Math.round(corner), included: true },
    nBolt: { quantity: Math.round(nBolt), included: true },
    cleat: { quantity: Math.round(cleat), included: true },
  }
}
