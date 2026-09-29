interface DetailGridProps {
  items: { label: string; value: React.ReactNode }[]
  cols?: 2 | 3 | 4
}

export function DetailGrid({ items, cols = 2 }: DetailGridProps) {
  const colClass = cols === 4 ? 'md:grid-cols-4' : cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
  return (
    <dl className={`grid grid-cols-1 ${colClass} gap-4 text-sm`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-text-secondary">{item.label}</dt>
          <dd className="font-medium mt-0.5">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
