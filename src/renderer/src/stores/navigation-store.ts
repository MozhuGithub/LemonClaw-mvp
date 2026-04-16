import { create } from 'zustand'

export type Page = 'chat' | 'agents' | 'settings'

interface NavigationState {
  currentPage: Page
  navigate: (page: Page) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentPage: 'chat',
  navigate: (page) => set({ currentPage: page }),
}))
