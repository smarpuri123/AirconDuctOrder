import { useEffect, useState } from 'react'
import { masterService } from '@/services/masterService'
import type { MasterLookup } from '@/types/crm'
import { MASTER_CATEGORY } from '@/types/crm'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const CATEGORIES = [
  { value: MASTER_CATEGORY.CONTACT_ROLE, label: 'Contact roles (project)' },
  { value: MASTER_CATEGORY.ENQUIRY_SOURCE, label: 'Enquiry sources' },
  { value: MASTER_CATEGORY.ENQUIRY_PRIORITY, label: 'Enquiry priorities' },
  { value: MASTER_CATEGORY.PROJECT_TYPE, label: 'Project types' },
]

export function MasterDataPanel() {
  const [category, setCategory] = useState<string>(MASTER_CATEGORY.CONTACT_ROLE)
  const [rows, setRows] = useState<MasterLookup[]>([])
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState('')

  const load = async () => {
    const list = await masterService.list(category)
    setRows(list)
  }

  useEffect(() => {
    load()
  }, [category])

  const handleAdd = async () => {
    if (!code.trim() || !label.trim()) return
    await masterService.addMaster({ category, code: code.trim(), label: label.trim() })
    setCode('')
    setLabel('')
    setStatus('Saved')
    await load()
  }

  return (
    <div className="space-y-4">
      <Select
        label="Master category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
      />

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-secondary border-b border-border">
            <th className="py-2 pr-2">Code</th>
            <th className="py-2">Label</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60">
              <td className="py-2 pr-2 font-mono text-xs">{r.code}</td>
              <td className="py-2">{r.label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border pt-4">
        <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SITE_ENGINEER" />
        <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Display name" />
        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={handleAdd}>Add value</Button>
          {status && <span className="text-sm text-success">{status}</span>}
        </div>
      </div>
    </div>
  )
}
