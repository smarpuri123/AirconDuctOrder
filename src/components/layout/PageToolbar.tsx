import type { ReactNode } from 'react'
import { ViewSwitcher } from '@/components/ui/ViewSwitcher'
import type { ListScreen } from '@/store/viewStore'

interface PageToolbarProps {
  screen?: ListScreen
  actions?: ReactNode
}

export function PageToolbar({ screen, actions }: PageToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
      {screen && <ViewSwitcher screen={screen} />}
    </div>
  )
}
