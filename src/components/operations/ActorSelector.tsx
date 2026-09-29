import { User } from 'lucide-react'
import { getCurrentUser, setCurrentUserId } from '@/lib/currentUser'
import { isApiMode } from '@/lib/api'
import { DEMO_USERS } from '@/types/user'
import { useState } from 'react'

export function ActorSelector() {
  const [userId, setUserId] = useState(getCurrentUser().id)

  const handleChange = (id: string) => {
    setCurrentUserId(id)
    setUserId(id)
  }

  const current = DEMO_USERS.find((u) => u.id === userId) ?? DEMO_USERS[0]

  return (
    <div className="flex items-center gap-2 text-sm">
      <User className="w-4 h-4 text-text-secondary shrink-0" />
      <label className="text-text-secondary whitespace-nowrap hidden sm:inline">Acting as</label>
      <select
        value={userId}
        onChange={(e) => handleChange(e.target.value)}
        className="text-sm border border-border rounded-md px-2 py-1.5 bg-surface text-text-primary max-w-[180px]"
        title="Select who is performing actions in this demo"
      >
        {DEMO_USERS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.role})
          </option>
        ))}
      </select>
      <span className="text-xs text-text-secondary hidden md:inline truncate max-w-[160px]">
        {current.role}
        {isApiMode ? ' · activity log' : ''}
      </span>
    </div>
  )
}
