import { Minus, Plus } from 'lucide-react'

interface QuantityControlProps {
  value: number
  max: number
  onChange: (value: number) => void
  size?: 'md' | 'lg'
}

export function QuantityControl({ value, max, onChange, size = 'lg' }: QuantityControlProps) {
  const btnSize = size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
  const textSize = size === 'lg' ? 'text-2xl' : 'text-xl'

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className={`${btnSize} flex items-center justify-center rounded-md border-2 border-border bg-surface text-primary hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
        aria-label="Decrease quantity"
      >
        <Minus className="w-5 h-5" />
      </button>
      <span className={`${textSize} font-bold tabular-nums w-10 text-center`}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${btnSize} flex items-center justify-center rounded-md border-2 border-primary bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
        aria-label="Increase quantity"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  )
}
