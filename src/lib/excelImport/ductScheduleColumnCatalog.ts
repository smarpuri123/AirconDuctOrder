import type { DuctImportFieldKey } from '@/types/excelImport'

export type DuctColumnRole = 'input' | 'calculated' | 'pivot'

export interface DuctScheduleColumnDef {
  fieldKey: DuctImportFieldKey
  header: string
  /** Second header row in shop-drawing sheets (W1, H1, …). */
  subHeader?: string
  role: DuctColumnRole
  required: boolean
  /** Calculated columns cannot be hidden when shop profile is active (still toggleable). */
  group: 'canonical' | 'shop' | 'billing'
}

export const DUCT_SCHEDULE_COLUMN_CATALOG: DuctScheduleColumnDef[] = [
  { fieldKey: 'tagNo', header: 'Duct No', role: 'input', required: true, group: 'canonical' },
  { fieldKey: 'description', header: 'Description', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'dai', header: 'Diameter (DAI)', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'width', header: 'Width (mm)', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'height', header: 'Height (mm)', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'w1', header: 'W1', subHeader: 'W1', role: 'input', required: false, group: 'shop' },
  { fieldKey: 'h1', header: 'H1', subHeader: 'H1', role: 'input', required: false, group: 'shop' },
  { fieldKey: 'w2', header: 'W2', subHeader: 'W2', role: 'input', required: false, group: 'shop' },
  { fieldKey: 'h2', header: 'H2', subHeader: 'H2', role: 'input', required: false, group: 'shop' },
  { fieldKey: 'length', header: 'Length (mm)', subHeader: 'L', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'quantity', header: 'Quantity', subHeader: 'QTY', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'gauge', header: 'Gauge', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'area', header: 'Area (SQ.MTR)', subHeader: 'AREA Sq.m', role: 'input', required: false, group: 'canonical' },
  { fieldKey: 'rmt', header: 'RMT', role: 'input', required: false, group: 'canonical' },
  {
    fieldKey: 'areaSqFt',
    header: 'Area (SQ.MTR)',
    subHeader: 'AREA Sq.m',
    role: 'calculated',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'sft24g',
    header: '24G TDF',
    subHeader: 'UPTO 750mm',
    role: 'calculated',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'sft22g',
    header: '22G TDF',
    subHeader: '750 - 1500mm',
    role: 'calculated',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'sft20g',
    header: '20G TDF',
    subHeader: 'ABOVE 1500mm',
    role: 'calculated',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'corner',
    header: 'CORNER',
    subHeader: 'QTY*8',
    role: 'calculated',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'nBolt',
    header: 'N/BOLT',
    subHeader: 'CORNER/2',
    role: 'calculated',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'cleat',
    header: 'CLEAT',
    subHeader: 'CLEAT',
    role: 'calculated',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'pivotTotalCorner',
    header: 'CORNNER (NOS)',
    role: 'pivot',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'pivotTotalNBolt',
    header: 'N/BOLT (NOS)',
    role: 'pivot',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'pivotTotalCleat',
    header: 'CLEAT (NOS)',
    role: 'pivot',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'pivotTotalAreaSqFt',
    header: 'Total area (SQ.MTR)',
    role: 'pivot',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'pivotTotal24g',
    header: '24G TDF (SQ.MTR)',
    role: 'pivot',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'pivotTotal22g',
    header: '22G TDF (SQ.MTR)',
    role: 'pivot',
    required: false,
    group: 'billing',
  },
  {
    fieldKey: 'pivotTotal20g',
    header: '20G TDF (SQ.MTR)',
    role: 'pivot',
    required: false,
    group: 'billing',
  },
]

const CALCULATED_KEYS = new Set(
  DUCT_SCHEDULE_COLUMN_CATALOG.filter((c) => c.role === 'calculated').map((c) => c.fieldKey),
)

const PIVOT_KEYS = new Set(
  DUCT_SCHEDULE_COLUMN_CATALOG.filter((c) => c.role === 'pivot').map((c) => c.fieldKey),
)

export function isCalculatedFieldKey(key: DuctImportFieldKey): boolean {
  return CALCULATED_KEYS.has(key)
}

export function isPivotFieldKey(key: DuctImportFieldKey): boolean {
  return PIVOT_KEYS.has(key)
}

export function catalogDef(fieldKey: DuctImportFieldKey): DuctScheduleColumnDef | undefined {
  return DUCT_SCHEDULE_COLUMN_CATALOG.find((c) => c.fieldKey === fieldKey)
}

/** Default shop-drawing grid: dimensions + billing + hardware columns (matches designer Excel). */
export const DEFAULT_SHOP_DRAWING_VISIBLE_KEYS: DuctImportFieldKey[] = [
  'tagNo',
  'description',
  'w1',
  'h1',
  'w2',
  'h2',
  'length',
  'quantity',
  'areaSqFt',
  'sft24g',
  'sft22g',
  'sft20g',
  'corner',
  'nBolt',
  'cleat',
]

export const DEFAULT_PIVOT_VISIBLE_KEYS: DuctImportFieldKey[] = [
  'pivotTotalCorner',
  'pivotTotalNBolt',
  'pivotTotalCleat',
  'pivotTotalAreaSqFt',
  'pivotTotal24g',
  'pivotTotal22g',
  'pivotTotal20g',
]
