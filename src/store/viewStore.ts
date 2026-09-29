import { create } from 'zustand'
import { loadFromStorage, saveToStorage } from '@/lib/storage'

export type DisplayView = 'card' | 'grid' | 'kanban'
export type ListScreen = 'enquiries' | 'orders' | 'dispatch'

interface ViewPreferences {
  enquiries: DisplayView
  orders: DisplayView
  dispatch: DisplayView
}

const defaults: ViewPreferences = {
  enquiries: 'card',
  orders: 'card',
  dispatch: 'card',
}

interface ViewState {
  preferences: ViewPreferences
  setView: (screen: ListScreen, view: DisplayView) => void
  getView: (screen: ListScreen) => DisplayView
}

function loadPreferences(): ViewPreferences {
  return loadFromStorage('viewPreferences', defaults)
}

export const useViewStore = create<ViewState>((set, get) => ({
  preferences: loadPreferences(),

  setView(screen, view) {
    const preferences = { ...get().preferences, [screen]: view }
    saveToStorage('viewPreferences', JSON.stringify(preferences))
    set({ preferences })
  },

  getView(screen) {
    return get().preferences[screen]
  },
}))
