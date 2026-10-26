import type { ColumnMapping, ParsedSheet } from '@/types/excelImport'
import { buildCanonicalMappings, validateDuctScheduleHeaders } from './canonicalTemplate'
import {
  applyShopDrawingLayout,
  buildShopDrawingMappings,
  isShopDrawingSheet,
} from './shopDrawingParse'

export function prepareSheetForImport(sheet: ParsedSheet): ParsedSheet {
  if (isShopDrawingSheet(sheet)) {
    return applyShopDrawingLayout(sheet)
  }
  return sheet
}

export function buildMappingsForSheet(sheet: ParsedSheet): ColumnMapping[] {
  const shopMappings = buildShopDrawingMappings(sheet)
  if (shopMappings.some((m) => m.fieldKey)) {
    return shopMappings
  }
  return buildCanonicalMappings(sheet)
}

export function validateSheetHeaders(sheet: ParsedSheet): string[] {
  if (isShopDrawingSheet(sheet)) {
    const mappings = buildShopDrawingMappings(sheet)
    const errors: string[] = []
    if (!mappings.some((m) => m.fieldKey === 'tagNo')) {
      errors.push('Could not find Duct No column in shop drawing header.')
    }
    if (!mappings.some((m) => m.fieldKey === 'length')) {
      errors.push('Could not find Length (L) column in shop drawing header.')
    }
    if (!mappings.some((m) => m.fieldKey === 'quantity')) {
      errors.push('Could not find Quantity (QTY) column in shop drawing header.')
    }
    return errors
  }
  return validateDuctScheduleHeaders(sheet.headers)
}
