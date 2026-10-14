import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ProjectSummary } from '@/types/crm'
import type { CodedClient } from '@/lib/businessCodes'
import { codeConflictMessage, findCodeConflict, nextProjectCode } from '@/lib/businessCodes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ProjectComboboxProps {
  clients: CodedClient[]
  projects: ProjectSummary[]
  value: string
  disabled?: boolean
  busy?: boolean
  onSelect: (projectId: string) => void
  onCreate: (input: { name: string; code: string }) => Promise<void>
}

export function ProjectCombobox({
  clients,
  projects,
  value,
  disabled,
  busy,
  onSelect,
  onCreate,
}: ProjectComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<{ name: string; code: string } | null>(null)

  const selected = projects.find((project) => project.id === value)
  const selectedLabel = selected ? `${selected.code} — ${selected.name}` : ''

  useEffect(() => {
    if (selected) {
      setQuery(`${selected.code} — ${selected.name}`)
      setDraft(null)
    }
  }, [selected])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const trimmed = query.trim()
  const searching = open && trimmed !== selectedLabel
  const needle = searching ? trimmed.toLowerCase() : ''

  const matches = useMemo(() => {
    if (!needle) return projects
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(needle) || project.code.toLowerCase().includes(needle),
    )
  }, [projects, needle])

  const exactMatch = projects.some(
    (project) =>
      project.name.toLowerCase() === trimmed.toLowerCase() ||
      project.code.toLowerCase() === trimmed.toLowerCase(),
  )
  const canAdd = searching && trimmed.length > 0 && !exactMatch

  const codeError = draft ? codeConflictMessage(findCodeConflict(draft.code, clients)) : ''

  const pick = (projectId: string) => {
    onSelect(projectId)
    setDraft(null)
    setOpen(false)
  }

  const startDraft = () => {
    if (!canAdd || busy) return
    setDraft({ name: trimmed, code: nextProjectCode(clients) })
    setOpen(false)
  }

  const confirmDraft = async () => {
    if (!draft || busy || codeError || !draft.name.trim() || !draft.code.trim()) return
    try {
      await onCreate({ name: draft.name.trim(), code: draft.code.trim() })
      setDraft(null)
    } catch {
      // The page shows the error and keeps this form open so the code can be changed.
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor="project-search" className="text-sm font-medium text-text-primary">
        Project<span className="text-error ml-0.5">*</span>
      </label>
      <input
        id="project-search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled || busy}
        placeholder={projects.length ? 'Search or add a project' : 'Type a project name to add it'}
        value={query}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          setDraft(null)
          setOpen(true)
          if (value && next !== selectedLabel) onSelect('')
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter' && open) {
            event.preventDefault()
            if (matches.length === 1 && !canAdd) pick(matches[0].id)
            else if (canAdd && matches.length === 0) startDraft()
          }
        }}
        className="h-12 px-4 rounded-md border bg-surface text-text-primary placeholder:text-neutral focus:outline-none focus:border-2 focus:border-primary transition-colors border-border disabled:opacity-60"
      />
      {open && !draft && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 top-full mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-surface shadow-lg"
        >
          {matches.map((project) => (
            <li key={project.id} role="option" aria-selected={project.id === value}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-background"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(project.id)}
              >
                {project.code} — {project.name}
              </button>
            </li>
          ))}
          {matches.length === 0 && !canAdd && (
            <li className="px-4 py-2.5 text-sm text-text-secondary">No projects yet. Type a name to add one.</li>
          )}
          {canAdd && (
            <li>
              <button
                type="button"
                disabled={busy}
                className="w-full text-left px-4 py-2.5 text-sm text-primary font-medium hover:bg-background flex items-center gap-2"
                onMouseDown={(event) => event.preventDefault()}
                onClick={startDraft}
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add project “{trimmed}”
              </button>
            </li>
          )}
        </ul>
      )}
      {draft && (
        <div className="mt-2 rounded-md border border-border p-3 space-y-3 bg-background">
          <Input
            label="Project name"
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <Input
            label="Project code"
            required
            value={draft.code}
            error={codeError}
            helper="Must not match a client code or another project code."
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || Boolean(codeError) || !draft.name.trim() || !draft.code.trim()}
              onClick={() => void confirmDraft()}
            >
              {busy ? 'Adding…' : 'Add project'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
