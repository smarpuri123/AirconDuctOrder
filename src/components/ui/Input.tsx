import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helper?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helper, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
            {props.required && <span className="text-error ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-12 px-4 rounded-md border bg-surface text-text-primary placeholder:text-neutral focus:outline-none focus:border-2 focus:border-primary transition-colors ${error ? 'border-error' : 'border-border'} ${className}`}
          {...props}
        />
        {helper && !error && <span className="text-xs text-text-secondary">{helper}</span>}
        {error && <span className="text-xs text-error">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'Input'
