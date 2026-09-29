import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  statusBorder?: 'success' | 'warning' | 'error' | 'primary'
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
}

const statusColors = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-error',
  primary: 'border-l-primary',
}

const paddings = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, statusBorder, hover, padding = 'md', className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg ${paddings[padding]} ${statusBorder ? `border-l-4 ${statusColors[statusBorder]}` : ''} ${hover ? 'hover:shadow-level-2 transition-shadow cursor-pointer' : 'shadow-level-1'} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
