import type { DuctImportFieldDef, DuctImportFieldKey } from '@/types/excelImport'

export const DUCT_IMPORT_FIELDS: DuctImportFieldDef[] = [
  { key: 'tagNo', label: 'Tag / Duct Number', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'dai', label: 'Diameter (DAI)', required: false },
  { key: 'width', label: 'Width (mm)', required: true },
  { key: 'height', label: 'Height (mm)', required: true },
  { key: 'length', label: 'Length (mm)', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'gauge', label: 'Gauge / Thickness', required: false },
  { key: 'area', label: 'Area (m²)', required: false },
  { key: 'rmt', label: 'Running meters (RMT)', required: false },
]

export const FIELD_ALIASES: Record<DuctImportFieldKey, string[]> = {
  tagNo: [
    'tag',
    'tag no',
    'tag.',
    'tag. no',
    'tag number',
    'duct no',
    'duct number',
    'sno',
    'sr no',
    'item no',
  ],
  description: ['description', 'desc', 'part', 'item', 'type', 'component'],
  dai: ['dai', 'dia', 'diameter', 'ø', 'od'],
  width: ['w', 'w(mm)', 'width', 'width mm', 'w mm'],
  height: ['h', 'h(mm)', 'height', 'height mm', 'h mm', 'depth'],
  length: ['length', 'length mm', 'l', 'l(mm)', 'len'],
  quantity: ['qty', 'quantity', 'qnty', 'nos', 'no'],
  gauge: ['gauge', 'thk', 'thickness', 'ga', 'sheet gauge'],
  area: ['area', 'area in sqmr', 'area m2', 'sqm', 'sq.m', 'm2', 'area in sqm'],
  rmt: ['rmt', 'rm', 'running meter', 'running metres', 'lin m'],
}

export function fieldDef(key: DuctImportFieldKey): DuctImportFieldDef {
  return DUCT_IMPORT_FIELDS.find((f) => f.key === key)!
}
