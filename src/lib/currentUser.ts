import { DEMO_USERS, type DemoUser } from '@/types/user'

const STORAGE_KEY = 'ecovent-current-user'

export function getCurrentUser(): DemoUser {
  try {
    const id = localStorage.getItem(STORAGE_KEY) ?? 'u-design'
    return DEMO_USERS.find((u) => u.id === id) ?? DEMO_USERS[1]
  } catch {
    return DEMO_USERS[1]
  }
}

export function setCurrentUserId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id)
}
