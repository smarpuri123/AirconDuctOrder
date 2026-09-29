import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const maxW = size === 'lg' ? 'max-w-2xl' : 'max-w-lg'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-surface rounded-t-xl sm:rounded-lg shadow-level-2 border border-border w-full ${maxW} max-h-[min(92dvh,720px)] flex flex-col`}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <h3 id="modal-title" className="font-semibold text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-background text-text-secondary"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <footer className="px-5 py-4 border-t border-border flex flex-wrap gap-2 justify-end shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
