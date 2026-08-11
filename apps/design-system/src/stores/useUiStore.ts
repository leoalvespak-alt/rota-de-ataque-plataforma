import { create } from 'zustand'

export type AppTab = 'create' | 'brand' | 'ai-config' | 'renders' | 'history' | 'editorial'
export type UiTheme = 'light' | 'dark'

const getInitialTheme = (): UiTheme => {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.dataset.uiTheme
    if (current === 'light' || current === 'dark') return current
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('rota-design-ui-theme') === 'light' ? 'light' : 'dark'
  }
  return 'dark'
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

/** Espelha setTab()/activeFilter do Gerador/index.html original (linhas 3445, 2890). */
export const useUiStore = create<UiState>()((set) => ({
  activeTab: 'create',
  theme: getInitialTheme(),
  leftPanelOpen: false,
  rightPanelOpen: false,
  setTab: (tab) => set({ activeTab: tab, leftPanelOpen: false, rightPanelOpen: false }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen, rightPanelOpen: false })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen, leftPanelOpen: false })),
  closePanels: () => set({ leftPanelOpen: false, rightPanelOpen: false }),
}))
