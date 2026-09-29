import { Minus, Plus } from 'lucide-react'

interface MobileQuantityControlProps {
  value: number
  max: number
  onChange: (value: number) => void
}

/** Touch-friendly +/- control for warehouse / mobile dispatch (min 56px targets). */
export function MobileQuantityControl({ value, max, onChange }: MobileQuantityControlProps) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className="w-14 h-14 flex items-center justify-center rounded-xl border-2 border-border bg-surface text-primary active:scale-95 disabled:opacity-35 transition-transform touch-manipulation"
        aria-label="Decrease quantity"
      >
        <Minus className="w-7 h-7 stroke-[2.5]" />
      </button>
      <span className="text-3xl font-bold tabular-nums w-12 text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-14 h-14 flex items-center justify-center rounded-xl border-2 border-primary bg-primary text-white active:scale-95 disabled:opacity-35 transition-transform touch-manipulation shadow-level-1"
        aria-label="Increase quantity"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>
    </div>
  )
}
