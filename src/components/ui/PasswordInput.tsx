import { useState, type InputHTMLAttributes, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  helper?: string
  error?: string
  inputClassName?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, helper, error, className = '', inputClassName = '', id, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const fieldClass =
      inputClassName ||
      `h-12 px-4 pr-11 rounded-md border bg-surface text-text-primary placeholder:text-neutral focus:outline-none focus:border-2 focus:border-primary transition-colors ${error ? 'border-error' : 'border-border'}`

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
            {props.required && <span className="text-error ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={`w-full ${fieldClass}`}
            autoComplete={props.autoComplete ?? 'current-password'}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </div>
        {helper && !error && <span className="text-xs text-text-secondary">{helper}</span>}
        {error && <span className="text-xs text-error">{error}</span>}
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
