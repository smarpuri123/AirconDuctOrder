import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

export interface KanbanColumn<T> {
  id: string
  title: string
  items: T[]
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[]
  renderCard: (item: T) => ReactNode
  onCardClick?: (item: T) => void
  getKey: (item: T) => string
}

export function KanbanBoard<T>({ columns, renderCard, onCardClick, getKey }: KanbanBoardProps<T>) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
      {columns.map((col) => (
        <div key={col.id} className="flex flex-col min-w-[240px] max-w-[280px] flex-1 shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-semibold text-text-primary">{col.title}</h3>
            <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded-full">
              {col.items.length}
            </span>
          </div>
          <div className="space-y-3 min-h-[120px]">
            {col.items.map((item) => (
              <Card
                key={getKey(item)}
                padding="sm"
                hover={!!onCardClick}
                onClick={() => onCardClick?.(item)}
                className="cursor-pointer"
              >
                {renderCard(item)}
              </Card>
            ))}
            {col.items.length === 0 && (
              <p className="text-xs text-text-secondary text-center py-6 border border-dashed border-border rounded-lg">
                Empty
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
