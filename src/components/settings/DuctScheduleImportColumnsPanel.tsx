import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { catalogDef } from '@/lib/excelImport/ductScheduleColumnCatalog'
import { labelForColumn } from '@/lib/excelImport/gridCompute'
import {
  getDuctImportProfile,
  getPivotColumnPreferences,
  preferencesForSettingsSections,
  reorderImportColumn,
  saveImportColumnPreferences,
  savePivotColumnPreferences,
  setDuctImportProfile,
  type DuctImportProfile,
  type ImportColumnPreference,
} from '@/lib/excelImport/importColumnSettings'

function ColumnList({
  title,
  prefs,
  onToggle,
  onMove,
  allowReorder,
}: {
  title: string
  prefs: ImportColumnPreference[]
  onToggle: (fieldKey: ImportColumnPreference['fieldKey']) => void
  onMove?: (fieldKey: ImportColumnPreference['fieldKey'], direction: 'up' | 'down') => void
  allowReorder: boolean
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="space-y-2">
        {prefs.map((p, idx) => {
          const col = catalogDef(p.fieldKey)
          if (!col) return null
          return (
            <li
              key={p.fieldKey}
              className="flex flex-wrap items-center gap-2 border border-border rounded-lg px-3 py-2"
            >
              <label className="flex items-center gap-2 flex-1 min-w-[12rem] cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.visible}
                  disabled={col.required}
                  onChange={() => onToggle(p.fieldKey)}
                />
                <span className="text-sm">
                  {labelForColumn(col)}
                  {col.required && (
                    <span className="text-text-secondary ml-1">(required)</span>
                  )}
                </span>
              </label>
              {allowReorder && onMove && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === 0}
                    onClick={() => onMove(p.fieldKey, 'up')}
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === prefs.length - 1}
                    onClick={() => onMove(p.fieldKey, 'down')}
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function DuctScheduleImportColumnsPanel() {
  const [profile, setProfile] = useState<DuctImportProfile>('canonical')
  const [sections, setSections] = useState(() => preferencesForSettingsSections())

  const reload = () => {
    setProfile(getDuctImportProfile())
    setSections(preferencesForSettingsSections())
  }

  useEffect(() => {
    reload()
  }, [])

  const toggleGrid = (fieldKey: ImportColumnPreference['fieldKey']) => {
    const col = catalogDef(fieldKey)
    if (col?.required) return
    const s = preferencesForSettingsSections()
    const flip = (list: ImportColumnPreference[]) =>
      list.map((p) => (p.fieldKey === fieldKey ? { ...p, visible: !p.visible } : p))
    saveImportColumnPreferences([...flip(s.inputs), ...flip(s.calculated)])
    reload()
  }

  const togglePivot = (fieldKey: ImportColumnPreference['fieldKey']) => {
    const next = getPivotColumnPreferences().map((p) =>
      p.fieldKey === fieldKey ? { ...p, visible: !p.visible } : p,
    )
    savePivotColumnPreferences(next)
    reload()
  }

  const applyProfile = (next: DuctImportProfile) => {
    setDuctImportProfile(next)
    reload()
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">
          Choose a layout profile. Shop drawing matches designer Excel (W1–H2, billable SFT, 24G/22G/20G
          columns). Calculated and pivot columns appear in the paste grid; pivot totals show in the footer
          for accounts.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={profile === 'canonical' ? 'primary' : 'secondary'}
            onClick={() => applyProfile('canonical')}
          >
            Simple template
          </Button>
          <Button
            type="button"
            size="sm"
            variant={profile === 'shop_drawing' ? 'primary' : 'secondary'}
            onClick={() => applyProfile('shop_drawing')}
          >
            Shop drawing (SAGAR-style)
          </Button>
        </div>
      </div>

      <ColumnList
        title="Input columns"
        prefs={sections.inputs}
        onToggle={toggleGrid}
        onMove={reorderImportColumn}
        allowReorder
      />

      <ColumnList
        title="Calculated columns"
        prefs={sections.calculated}
        onToggle={toggleGrid}
        allowReorder={false}
      />

      <ColumnList
        title="Pivot totals (footer)"
        prefs={sections.pivot}
        onToggle={togglePivot}
        allowReorder={false}
      />
    </div>
  )
}
