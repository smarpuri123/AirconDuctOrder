import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { NotificationToastStack } from './NotificationToast'

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const startSession = useNotificationStore((s) => s.startSession)
  const endSession = useNotificationStore((s) => s.endSession)

  useEffect(() => {
    registerSW({ immediate: true })
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (user) {
      void startSession()
    } else {
      endSession()
    }
  }, [user, initialized, startSession, endSession])

  return (
    <>
      {children}
      <NotificationToastStack />
    </>
  )
}
