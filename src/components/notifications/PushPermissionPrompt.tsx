import { Button } from '@/components/ui/Button'

interface PushPermissionPromptProps {
  onEnable: () => void
  onDismiss: () => void
  loading?: boolean
}

export function PushPermissionPrompt({ onEnable, onDismiss, loading }: PushPermissionPromptProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <p className="text-sm font-medium">Enable browser notifications?</p>
      <p className="text-sm text-text-secondary">
        Get important Duct Dispatch updates even when this tab is not open. You can change this anytime in Settings.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onEnable} disabled={loading}>
          {loading ? 'Enabling…' : 'Enable notifications'}
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={loading}>
          Not now
        </Button>
      </div>
    </div>
  )
}
