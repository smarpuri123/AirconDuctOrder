import { useState } from 'react'
import { Check, Download, Loader2 } from 'lucide-react'
import { downloadEnquiryDocument } from '@/lib/enquiryDocuments'
import type { EnquiryDesignDocument } from '@/types/enquiry'

export interface DocumentDownloadButtonProps {
  document: EnquiryDesignDocument
  enquiryId?: string
  /**
   * 'button': Renders as a standard secondary Button (e.g., in EnquiryDesignFiles).
   * 'link': Renders as an inline clickable icon + text button (e.g., in lists & timeline).
   */
  variant?: 'button' | 'link'
  size?: 'sm' | 'md'
  className?: string
  label?: string
  iconSize?: 'sm' | 'md'
}

export function DocumentDownloadButton({
  document,
  enquiryId,
  variant = 'button',
  size = 'sm',
  className = '',
  label,
  iconSize = 'md',
}: DocumentDownloadButtonProps) {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'downloaded' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const docWithEnquiry = enquiryId ? { ...document, enquiryId } : document
  const isBusy = status === 'downloading'
  const iconClass = iconSize === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isBusy) return
    setStatus('downloading')
    setErrorMessage('')

    try {
      await downloadEnquiryDocument(docWithEnquiry)
      setStatus('downloaded')
      setTimeout(() => {
        setStatus('idle')
      }, 2000)
    } catch (err) {
      console.error('Download failed:', err)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Download failed')
      setTimeout(() => {
        setStatus('idle')
        setErrorMessage('')
      }, 3500)
    }
  }

  const defaultLabel = label ?? 'Download'

  const renderContent = () => {
    if (status === 'downloading') {
      return (
        <>
          <Loader2 className={`${iconClass} animate-spin text-primary shrink-0`} />
          <span>Downloading…</span>
        </>
      )
    }
    if (status === 'downloaded') {
      return (
        <>
          <Check className={`${iconClass} text-success shrink-0`} />
          <span className="text-success font-medium">Downloaded</span>
        </>
      )
    }
    if (status === 'error') {
      return (
        <span className="text-error font-medium" title={errorMessage || 'Download failed'}>
          Failed
        </span>
      )
    }
    return (
      <>
        <Download className={`${iconClass} shrink-0`} />
        <span>{defaultLabel}</span>
      </>
    )
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        disabled={isBusy}
        onClick={handleDownload}
        title={status === 'error' ? errorMessage : undefined}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface font-semibold text-text-primary transition-colors hover:bg-background active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
          size === 'sm' ? 'px-3 py-1.5 text-xs min-h-[34px]' : 'px-4 py-2 text-sm min-h-[40px]'
        } ${className}`}
      >
        {renderContent()}
      </button>
    )
  }

  // Link variant (inline clickable)
  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={handleDownload}
      title={status === 'error' ? errorMessage : undefined}
      className={`inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60 disabled:no-underline disabled:cursor-not-allowed shrink-0 transition-opacity ${className}`}
    >
      {renderContent()}
    </button>
  )
}
