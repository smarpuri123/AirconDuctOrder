import { type ReactNode } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react'

export interface WorkflowConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'warning' | 'danger'
  busy?: boolean
  busyText?: string
  showNote?: boolean
  noteLabel?: string
  notePlaceholder?: string
  noteValue?: string
  onNoteChange?: (val: string) => void
  children?: ReactNode
}

export function WorkflowConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  busy = false,
  busyText = 'Processing…',
  showNote = false,
  noteLabel = 'Reason / Note (optional)',
  notePlaceholder = 'Add an optional note…',
  noteValue = '',
  onNoteChange,
  children,
}: WorkflowConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === 'warning' ? 'secondary' : variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
            className={variant === 'warning' ? 'border-warning/50 text-warning hover:bg-warning/10' : ''}
          >
            {busy ? busyText : confirmText}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full shrink-0 bg-background border border-border">
            {variant === 'warning' || variant === 'danger' ? (
              <AlertCircle className={`w-5 h-5 ${variant === 'danger' ? 'text-danger' : 'text-warning'}`} />
            ) : (
              <HelpCircle className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">{title}</p>
            {description && (
              <p className="text-sm text-text-secondary">{description}</p>
            )}
          </div>
        </div>

        {children}

        {showNote && onNoteChange && (
          <div className="pt-2">
            <Textarea
              label={noteLabel}
              placeholder={notePlaceholder}
              value={noteValue}
              onChange={(e) => onNoteChange(e.target.value)}
              disabled={busy}
              rows={3}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

export interface StepSuccessModalProps {
  open: boolean
  onClose: () => void
  title?: string
  message: string
}

export function StepSuccessModal({
  open,
  onClose,
  title = 'Action Completed',
  message,
}: StepSuccessModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button type="button" onClick={onClose} className="w-full sm:w-auto">
          Continue
        </Button>
      }
    >
      <div className="flex items-center gap-3 py-2">
        <div className="p-2 rounded-full shrink-0 bg-success/10 text-success">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <p className="font-medium text-text-primary">{title}</p>
          <p className="text-sm text-text-secondary mt-0.5">{message}</p>
        </div>
      </div>
    </Modal>
  )
}
