import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { isApiMode } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { ActorSelector } from '@/components/operations/ActorSelector'

export function UserMenu() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!isApiMode) {
    return <ActorSelector />
  }

  if (!user) return null

  const roleLabel = user.roles.join(', ') || 'User'

  const handleSignOut = () => {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-1.5 bg-surface hover:bg-primary-muted/40 transition-colors max-w-[240px]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User className="w-4 h-4 text-text-secondary shrink-0" />
        <span className="truncate font-medium">{user.name}</span>
        <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface shadow-level-3 py-1 z-50"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-text-secondary truncate">@{user.username}</p>
            <p className="text-xs text-text-secondary mt-1">{roleLabel}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-primary-muted/50 text-error"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
