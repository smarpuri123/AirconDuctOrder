import { useRef, useState, type DragEvent } from 'react'
import { FileUp, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export interface FileUploadZoneProps {
  accept: string
  multiple?: boolean
  files: File[]
  onFilesChange: (files: File[]) => void
  disabled?: boolean
  /** Short line under the main CTA */
  hint?: string
  className?: string
  /** When set, each selected file shows a remove control */
  onRemoveFile?: (index: number) => void
}

function mergeFiles(existing: File[], incoming: File[]): File[] {
  const keys = new Set(existing.map((f) => `${f.name}:${f.size}`))
  const next = [...existing]
  for (const file of incoming) {
    const key = `${file.name}:${file.size}`
    if (!keys.has(key)) {
      keys.add(key)
      next.push(file)
    }
  }
  return next
}

export function FileUploadZone({
  accept,
  multiple = true,
  files,
  onFilesChange,
  disabled = false,
  hint = 'PDF, DWG, DXF, images, Office documents, ZIP',
  className = '',
  onRemoveFile,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const pickFiles = (list: FileList | null) => {
    if (!list?.length || disabled) return
    const added = Array.from(list)
    onFilesChange(multiple ? mergeFiles(files, added) : added.slice(0, 1))
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setDragOver(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    pickFiles(e.dataTransfer.files)
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => pickFiles(e.target.files)}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragOver={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-border bg-background'
            : dragOver
              ? 'border-primary bg-primary-muted/50 ring-2 ring-primary/25'
              : 'border-primary/50 bg-primary-muted/25 hover:border-primary hover:bg-primary-muted/40'
        }`}
      >
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              dragOver ? 'bg-primary text-white' : 'bg-primary/15 text-primary'
            }`}
          >
            <Upload className="w-7 h-7" strokeWidth={2} />
          </div>
          <div>
            <p className="text-base font-semibold text-text-primary">
              {dragOver ? 'Drop files here' : 'Click to upload client files'}
            </p>
            <p className="text-sm text-text-secondary mt-1">or drag and drop into this area</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="pointer-events-none mt-1"
            tabIndex={-1}
            aria-hidden
          >
            <FileUp className="w-4 h-4" />
            Choose files
          </Button>
          <p className="text-xs text-text-secondary max-w-md">{hint}</p>
        </div>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          <p className="text-sm font-medium text-text-primary">
            Selected ({files.length})
          </p>
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="text-sm text-text-secondary flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              <FileUp className="w-4 h-4 shrink-0 text-primary" />
              <span className="truncate flex-1 min-w-0">{f.name}</span>
              {onRemoveFile && (
                <button
                  type="button"
                  disabled={disabled}
                  className="shrink-0 p-1 rounded hover:bg-background text-text-secondary disabled:opacity-50"
                  aria-label={`Remove ${f.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile(i)
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
