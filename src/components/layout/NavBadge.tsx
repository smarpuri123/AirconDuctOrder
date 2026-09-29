import { formatBadgeCount } from '@/lib/workQueue'

export function NavBadge({ count }: { count: number }) {
  const label = formatBadgeCount(count)
  if (!label) return null
  return (
    <span
      className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-error text-white text-[11px] font-bold tabular-nums flex items-center justify-center"
      aria-label={`${count} items need attention`}
    >
      {label}
    </span>
  )
}
