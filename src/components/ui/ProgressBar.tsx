interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, max = 100, label, showPercent = true, size = 'md' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const height = size === 'sm' ? 'h-2' : 'h-3'

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-text-secondary">{label}</span>}
          {showPercent && <span className="text-sm font-semibold tabular-nums text-primary">{percent}%</span>}
        </div>
      )}
      <div className={`w-full ${height} bg-background rounded-full overflow-hidden`}>
        <div
          className={`${height} bg-primary rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
