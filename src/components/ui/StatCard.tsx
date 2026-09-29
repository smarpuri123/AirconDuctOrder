import type { LucideIcon } from 'lucide-react'
import { Card } from './Card'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  subtext?: string
}

export function StatCard({ label, value, icon: Icon, subtext }: StatCardProps) {
  return (
    <Card className="h-full" padding="sm">
      <div className="flex flex-col justify-between h-full min-h-[6.75rem] gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary font-medium leading-snug">{label}</p>
          {subtext && <p className="text-xs text-text-secondary mt-1">{subtext}</p>}
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="text-3xl font-bold tabular-nums text-text-primary leading-none">{value}</p>
          {Icon && (
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
