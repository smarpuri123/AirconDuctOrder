import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FileUploadZone } from '@/components/ui/FileUploadZone'
import {
  ENQUIRY_FILE_ACCEPT,
  downloadEnquiryDocument,
  filesToPayloadsWithProgress,
} from '@/lib/enquiryDocuments'
import { isApiMode } from '@/lib/api'
import { enquiryService } from '@/services/enquiryService'
import type { EnquiryDesignDocument } from '@/types/enquiry'

interface EnquiryDesignFilesProps {
  enquiryId: string
  documents: EnquiryDesignDocument[]
  allowUpload?: boolean
  onSaved?: () => void | Promise<void>
}

type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'success' | 'error'

export function EnquiryDesignFiles({
  enquiryId,
  documents,
  allowUpload = false,
  onSaved,
}: EnquiryDesignFilesProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const current = documents.filter((d) => d.isCurrent)
  const busy = phase === 'preparing' || phase === 'uploading'

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearPending = () => {
    if (busy) return
    setPendingFiles([])
    setError(null)
    setPhase('idle')
    setProgress(0)
    setStatusText('')
  }

  const handleSaveRevision = async () => {
    if (!pendingFiles.length || busy) return
    setError(null)
    setProgress(0)
    setPhase('preparing')
    setStatusText('Preparing files…')

    try {
      const payloads = await filesToPayloadsWithProgress(pendingFiles, (pct) => {
        setProgress(Math.round(pct * 0.35))
        setStatusText(`Preparing files… ${pct}%`)
      })

      setPhase('uploading')
      setStatusText('Uploading to server…')
      setProgress(40)

      await enquiryService.uploadInputFilesWithProgress(enquiryId, payloads, (pct) => {
        setProgress(40 + Math.round(pct * 0.6))
        setStatusText(`Uploading… ${pct}%`)
      })

      setProgress(100)
      setPhase('success')
      setStatusText('Revision saved')
      setPendingFiles([])
      await onSaved?.()
      setTimeout(() => {
        setPhase('idle')
        setProgress(0)
        setStatusText('')
      }, 2500)
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Could not save files')
      setStatusText('')
    }
  }

  return (
    <div className="space-y-4">
      {current.length === 0 ? (
        <p className="text-sm text-text-secondary">No client input files on record.</p>
      ) : (
        <ul className="space-y-2">
          {current.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{doc.fileName}</p>
                <p className="text-xs text-text-secondary">
                  Input Rev {String(doc.inputRevision).padStart(2, '0')}
                  {doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ''}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="min-w-0 shrink-0"
                onClick={() => downloadEnquiryDocument({ ...doc, enquiryId }, isApiMode)}
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </li>
          ))}
        </ul>
      )}

      {allowUpload && (
        <div className="rounded-lg border border-border bg-background/60 p-4 space-y-4">
          <FileUploadZone
            accept={ENQUIRY_FILE_ACCEPT}
            files={pendingFiles}
            onFilesChange={(next) => {
              setError(null)
              setPhase('idle')
              setPendingFiles(next)
            }}
            disabled={busy}
            hint="Choose files, then save as a new input revision. Older revisions stay in the activity log."
            onRemoveFile={removePending}
          />

          {(busy || phase === 'success') && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex justify-between text-xs text-text-secondary">
                <span>{statusText || (phase === 'success' ? 'Done' : 'Working…')}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-200 ease-out ${
                    phase === 'success' ? 'bg-success' : 'bg-primary'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-error" role="alert">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || pendingFiles.length === 0}
              onClick={handleSaveRevision}
            >
              Save revision
            </Button>
            {pendingFiles.length > 0 && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={clearPending}>
                Clear
              </Button>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
