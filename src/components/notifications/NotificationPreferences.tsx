import { useState } from 'react'
import { isApiMode } from '@/lib/api'
import { isPushSupported } from '@/lib/pushSubscription'
import { useNotificationStore } from '@/store/notificationStore'
import { Button } from '@/components/ui/Button'
import { PushPermissionPrompt } from './PushPermissionPrompt'

export function NotificationPreferences() {
  const { preferences, pushConfigured, updatePreferences, subscribeToPush, unsubscribeFromPush } =
    useNotificationStore()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  if (!isApiMode) {
    return (
      <p className="text-sm text-text-secondary">
        In-app and push notifications are available when the app is connected to the API server.
      </p>
    )
  }

  const handleInApp = async (checked: boolean) => {
    setBusy(true)
    try {
      await updatePreferences({ inAppEnabled: checked })
    } finally {
      setBusy(false)
    }
  }

  const handlePushToggle = async (checked: boolean) => {
    setMessage(null)
    if (checked) {
      setShowPushPrompt(true)
      return
    }
    setBusy(true)
    try {
      await unsubscribeFromPush()
    } finally {
      setBusy(false)
    }
  }

  const enablePush = async () => {
    setBusy(true)
    setMessage(null)
    const result = await subscribeToPush()
    setBusy(false)
    setShowPushPrompt(false)
    if (!result.ok) setMessage(result.reason ?? 'Could not enable browser notifications')
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-border"
          checked={preferences.inAppEnabled}
          disabled={busy}
          onChange={(e) => void handleInApp(e.target.checked)}
        />
        <span>
          <span className="font-medium block">In-app notifications</span>
          <span className="text-text-secondary">Show updates in the notification bell and live toasts</span>
        </span>
      </label>

      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-border"
          checked={preferences.pushEnabled}
          disabled={busy || !pushConfigured || !isPushSupported()}
          onChange={(e) => void handlePushToggle(e.target.checked)}
        />
        <span>
          <span className="font-medium block">Browser notifications</span>
          <span className="text-text-secondary">
            {pushConfigured
              ? 'Receive alerts when the app is in the background'
              : 'Server push is not configured (VAPID keys)'}
          </span>
        </span>
      </label>

      {message && <p className="text-sm text-error">{message}</p>}

      {showPushPrompt && (
        <PushPermissionPrompt
          onEnable={() => void enablePush()}
          onDismiss={() => setShowPushPrompt(false)}
          loading={busy}
        />
      )}

      {preferences.pushEnabled && (
        <Button variant="secondary" disabled={busy} onClick={() => void unsubscribeFromPush()}>
          Remove browser subscription
        </Button>
      )}
    </div>
  )
}
