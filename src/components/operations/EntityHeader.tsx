import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

interface EntityHeaderProps {
  backTo: string
  backLabel?: string
  title: string
  subtitle?: string
  badge?: ReactNode
  actions?: ReactNode
}

export function EntityHeader({ backTo, backLabel = 'Back', title, subtitle, badge, actions }: EntityHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(backTo)}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {subtitle && <p className="text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {badge}
          {actions}
        </div>
      </div>
    </div>
  )
}
