import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover disabled:bg-border disabled:text-neutral',
  secondary: 'bg-surface text-secondary border-2 border-secondary hover:bg-secondary-muted disabled:border-border disabled:text-neutral',
  gold: 'bg-secondary text-white hover:bg-secondary-hover disabled:bg-border disabled:text-neutral',
  ghost: 'bg-transparent text-primary hover:bg-background disabled:text-neutral',
  danger: 'bg-error text-white hover:opacity-90',
}

const sizes: Record<string, string> = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-6 text-base',
  lg: 'h-14 px-8 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors ${fullWidth ? 'w-full min-w-0' : 'min-w-[120px]'} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
