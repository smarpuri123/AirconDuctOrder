import { create } from 'zustand'
import type { CreateDispatchDraft } from '@/types'

interface AppState {
  searchQuery: string
  orderFilter: string
  dispatchDraft: Partial<CreateDispatchDraft> | null
  setSearchQuery: (q: string) => void
  setOrderFilter: (f: string) => void
  setDispatchDraft: (draft: Partial<CreateDispatchDraft> | null) => void
  updateDraftQuantities: (quantities: Record<string, number>) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  searchQuery: '',
  orderFilter: 'all',
  dispatchDraft: null,
  setSearchQuery: (q) => set({ searchQuery: q }),
  setOrderFilter: (f) => set({ orderFilter: f }),
  setDispatchDraft: (draft) => set({ dispatchDraft: draft }),
  updateDraftQuantities: (quantities) =>
    set((state) => ({
      dispatchDraft: state.dispatchDraft
        ? { ...state.dispatchDraft, quantities }
        : { quantities },
    })),
  reset: () => set({ searchQuery: '', orderFilter: 'all', dispatchDraft: null }),
}))
