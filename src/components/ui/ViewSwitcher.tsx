import { Columns3, Grid3x3, LayoutGrid } from 'lucide-react'
import type { DisplayView, ListScreen } from '@/store/viewStore'
import { useViewStore } from '@/store/viewStore'

const views: { id: DisplayView; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'card', label: 'Cards', icon: LayoutGrid },
  { id: 'grid', label: 'Grid', icon: Grid3x3 },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
]

interface ViewSwitcherProps {
  screen: ListScreen
}

export function ViewSwitcher({ screen }: ViewSwitcherProps) {
  const current = useViewStore((s) => s.preferences[screen])
  const setView = useViewStore((s) => s.setView)

  return (
    <div className="flex items-center gap-1 p-1 bg-background rounded-md border border-border">
      {views.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => setView(screen, id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            current === id
              ? 'bg-primary text-white'
              : 'text-text-secondary hover:text-primary hover:bg-surface'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
