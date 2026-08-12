import { create } from 'zustand'

export type AppTab = 'dashboard' | 'brand' | 'ai-config' | 'renders' | 'history' | 'editorial' | 'create' | 'wizard'
export type UiTheme = 'light' | 'dark'

const getInitialTheme = (): UiTheme => {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.dataset.uiTheme
    if (current === 'light' || current === 'dark') return current
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('rota-design-ui-theme')
    if (stored === 'dark') return 'dark'
  }
  return 'light'
}

interface UiState {
  activeTab: AppTab
  theme: UiTheme
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  setTab: (tab: AppTab) => void
  toggleTheme: () => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  closePanels: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  activeTab: 'dashboard',
  theme: getInitialTheme(),
  leftPanelOpen: false,
  rightPanelOpen: false,
  setTab: (tab) => set({ activeTab: tab, leftPanelOpen: false, rightPanelOpen: false }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen, rightPanelOpen: false })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen, leftPanelOpen: false })),
  closePanels: () => set({ leftPanelOpen: false, rightPanelOpen: false }),
}))
