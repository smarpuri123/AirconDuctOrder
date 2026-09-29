import type { OrderStatus, DispatchStatus } from '@/types'
import { getDispatchStatusLabel, getStatusLabel } from '@/lib/calculations'

type ChipVariant = 'default' | 'success' | 'warning' | 'error' | 'primary' | 'secondary'

interface ChipProps {
  children: React.ReactNode
  variant?: ChipVariant
}

const variants: Record<ChipVariant, string> = {
  default: 'bg-background text-text-primary',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-error-bg text-error',
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
}

export function Chip({ children, variant = 'default' }: ChipProps) {
  return (
    <span className={`inline-flex items-center h-8 px-3 rounded-full text-sm font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const variantMap: Record<OrderStatus, ChipVariant> = {
    draft: 'default',
    imported: 'primary',
    production: 'secondary',
    ready: 'primary',
    partially_dispatched: 'secondary',
    fully_dispatched: 'success',
    closed: 'default',
    cancelled: 'error',
  }
  return <Chip variant={variantMap[status]}>{getStatusLabel(status)}</Chip>
}

export function DispatchStatusChip({ status }: { status: DispatchStatus }) {
  const variantMap: Record<DispatchStatus, ChipVariant> = {
    draft: 'default',
    loading: 'secondary',
    loaded: 'primary',
    dispatched: 'primary',
    delivered: 'success',
  }
  return <Chip variant={variantMap[status]}>{getDispatchStatusLabel(status)}</Chip>
}
