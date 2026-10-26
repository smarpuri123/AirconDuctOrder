import type { DuctImportFieldKey } from '@/types/excelImport'
import {
  catalogDef,
  DEFAULT_PIVOT_VISIBLE_KEYS,
  DEFAULT_SHOP_DRAWING_VISIBLE_KEYS,
  DUCT_SCHEDULE_COLUMN_CATALOG,
  type DuctScheduleColumnDef,
} from './ductScheduleColumnCatalog'
import {
  DUCT_SCHEDULE_CANONICAL_COLUMNS,
  type CanonicalColumn,
} from './canonicalTemplate'

const STORAGE_KEY = 'ecovent_duct_import_columns'
const PIVOT_STORAGE_KEY = 'ecovent_duct_import_pivot_columns'
const PROFILE_KEY = 'ecovent_duct_import_profile'

export type DuctImportProfile = 'canonical' | 'shop_drawing'

export interface ImportColumnPreference {
  fieldKey: DuctImportFieldKey
  visible: boolean
}

function defaultCanonicalPreferences(): ImportColumnPreference[] {
  return DUCT_SCHEDULE_CANONICAL_COLUMNS.map((c) => ({
    fieldKey: c.fieldKey,
    visible: true,
  }))
}

function defaultShopPreferences(): ImportColumnPreference[] {
  const keys = new Set(DEFAULT_SHOP_DRAWING_VISIBLE_KEYS)
  return DUCT_SCHEDULE_COLUMN_CATALOG.filter((c) => c.role === 'input' || c.role === 'calculated').map(
    (c) => ({
      fieldKey: c.fieldKey,
      visible: keys.has(c.fieldKey),
    }),
  )
}

function defaultPivotPreferences(): ImportColumnPreference[] {
  const keys = new Set(DEFAULT_PIVOT_VISIBLE_KEYS)
  return DUCT_SCHEDULE_COLUMN_CATALOG.filter((c) => c.role === 'pivot').map((c) => ({
    fieldKey: c.fieldKey,
    visible: keys.has(c.fieldKey),
  }))
}

function mergeWithCatalog(
  parsed: ImportColumnPreference[],
  roleFilter: 'input' | 'calculated' | 'pivot' | 'grid',
): ImportColumnPreference[] {
  let catalog = DUCT_SCHEDULE_COLUMN_CATALOG
  if (roleFilter === 'input') {
    catalog = catalog.filter((c) => c.role === 'input')
  } else if (roleFilter === 'calculated') {
    catalog = catalog.filter((c) => c.role === 'calculated')
  } else if (roleFilter === 'pivot') {
    catalog = catalog.filter((c) => c.role === 'pivot')
  } else if (roleFilter === 'grid') {
    catalog = catalog.filter((c) => c.role === 'input' || c.role === 'calculated')
  }

  const known = new Set(catalog.map((c) => c.fieldKey))
  const merged: ImportColumnPreference[] = []
  for (const p of parsed) {
    if (known.has(p.fieldKey)) {
      merged.push({ fieldKey: p.fieldKey, visible: Boolean(p.visible) })
    }
  }
  for (const col of catalog) {
    if (!merged.some((m) => m.fieldKey === col.fieldKey)) {
      merged.push({ fieldKey: col.fieldKey, visible: true })
    }
  }
  return merged
}

function loadGridRaw(): ImportColumnPreference[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultCanonicalPreferences()
    const parsed = JSON.parse(raw) as ImportColumnPreference[]
    return mergeWithCatalog(parsed, 'grid')
  } catch {
    return defaultCanonicalPreferences()
  }
}

function loadPivotRaw(): ImportColumnPreference[] {
  try {
    const raw = localStorage.getItem(PIVOT_STORAGE_KEY)
    if (!raw) return defaultPivotPreferences()
    const parsed = JSON.parse(raw) as ImportColumnPreference[]
    return mergeWithCatalog(parsed, 'pivot')
  } catch {
    return defaultPivotPreferences()
  }
}

export function getDuctImportProfile(): DuctImportProfile {
  try {
    const v = localStorage.getItem(PROFILE_KEY)
    if (v === 'shop_drawing') return 'shop_drawing'
  } catch {
    /* ignore */
  }
  return 'canonical'
}

export function setDuctImportProfile(profile: DuctImportProfile) {
  localStorage.setItem(PROFILE_KEY, profile)
  if (profile === 'shop_drawing') {
    saveImportColumnPreferences(defaultShopPreferences())
    savePivotColumnPreferences(defaultPivotPreferences())
  }
}

export function getImportColumnPreferences(): ImportColumnPreference[] {
  const prefs = loadGridRaw()
  return prefs.map((p) => {
    const col = catalogDef(p.fieldKey)
    if (col?.required) return { ...p, visible: true }
    return p
  })
}

export function getPivotColumnPreferences(): ImportColumnPreference[] {
  return loadPivotRaw()
}

export function saveImportColumnPreferences(prefs: ImportColumnPreference[]) {
  const next = mergeWithCatalog(prefs, 'grid').map((p) => {
    const col = catalogDef(p.fieldKey)
    return {
      fieldKey: p.fieldKey,
      visible: col?.required ? true : Boolean(p.visible),
    }
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function savePivotColumnPreferences(prefs: ImportColumnPreference[]) {
  const next = mergeWithCatalog(prefs, 'pivot')
  localStorage.setItem(PIVOT_STORAGE_KEY, JSON.stringify(next))
}

function toCanonicalColumn(def: DuctScheduleColumnDef): CanonicalColumn {
  return {
    fieldKey: def.fieldKey,
    header: def.header,
    required: def.required,
  }
}

/** Input columns only — used for Excel template download and import mapping. */
export function getConfiguredImportColumns(): CanonicalColumn[] {
  const prefs = getImportColumnPreferences()
  const byKey = new Map(DUCT_SCHEDULE_COLUMN_CATALOG.map((c) => [c.fieldKey, c]))
  const ordered: CanonicalColumn[] = []
  for (const p of prefs) {
    if (!p.visible) continue
    const col = byKey.get(p.fieldKey)
    if (col?.role === 'input') ordered.push(toCanonicalColumn(col))
  }
  if (ordered.length > 0) return ordered
  return DUCT_SCHEDULE_CANONICAL_COLUMNS.map((c) => ({ ...c }))
}

export function getConfiguredGridColumnDefs(): DuctScheduleColumnDef[] {
  const prefs = getImportColumnPreferences()
  const byKey = new Map(DUCT_SCHEDULE_COLUMN_CATALOG.map((c) => [c.fieldKey, c]))
  const ordered: DuctScheduleColumnDef[] = []
  for (const p of prefs) {
    if (!p.visible) continue
    const col = byKey.get(p.fieldKey)
    if (col && col.role !== 'pivot') ordered.push(col)
  }
  return ordered.length > 0
    ? ordered
    : DUCT_SCHEDULE_COLUMN_CATALOG.filter((c) => c.role !== 'pivot')
}

export function getConfiguredPivotColumnDefs(): DuctScheduleColumnDef[] {
  const prefs = getPivotColumnPreferences()
  const byKey = new Map(DUCT_SCHEDULE_COLUMN_CATALOG.map((c) => [c.fieldKey, c]))
  const ordered: DuctScheduleColumnDef[] = []
  for (const p of prefs) {
    if (!p.visible) continue
    const col = byKey.get(p.fieldKey)
    if (col?.role === 'pivot') ordered.push(col)
  }
  return ordered
}

export function reorderImportColumn(fieldKey: DuctImportFieldKey, direction: 'up' | 'down') {
  const prefs = loadGridRaw()
  const idx = prefs.findIndex((p) => p.fieldKey === fieldKey)
  if (idx < 0) return
  const swap = direction === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= prefs.length) return
  const copy = [...prefs]
  ;[copy[idx], copy[swap]] = [copy[swap], copy[idx]]
  saveImportColumnPreferences(copy)
}

export function preferencesForSettingsSections(): {
  inputs: ImportColumnPreference[]
  calculated: ImportColumnPreference[]
  pivot: ImportColumnPreference[]
} {
  const grid = loadGridRaw()
  const pivot = loadPivotRaw()
  const inputKeys = new Set(
    DUCT_SCHEDULE_COLUMN_CATALOG.filter((c) => c.role === 'input').map((c) => c.fieldKey),
  )
  const calcKeys = new Set(
    DUCT_SCHEDULE_COLUMN_CATALOG.filter((c) => c.role === 'calculated').map((c) => c.fieldKey),
  )
  return {
    inputs: grid.filter((p) => inputKeys.has(p.fieldKey)),
    calculated: grid.filter((p) => calcKeys.has(p.fieldKey)),
    pivot,
  }
}
