import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { useUiStore, type AppTab } from '@/stores/useUiStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useExportCard } from '@/lib/export/useExportCard'
import { useSaveArt } from '@/features/history/useSaveArt'
import { CommandPalette } from '@/features/commands/CommandPalette'
import { useTemplateLibraryStore } from '@/stores/useTemplateLibraryStore'
import { useRouteSync } from '@/hooks/useRouteSync'

const TAB_ORDER: AppTab[] = ['dashboard', 'brand', 'ai-config', 'renders', 'history', 'editorial']

export function AppShell() {
  const location = useLocation()
  const activeTab = useUiStore((s) => s.activeTab)
  const theme = useUiStore((s) => s.theme)
  const setTab = useUiStore((s) => s.setTab)
  const closeTemplateLibrary = useTemplateLibraryStore((s) => s.closeLibrary)
  const undo = () => useEditorStore.temporal.getState().undo()
  const redo = () => useEditorStore.temporal.getState().redo()
  const { downloadPNG } = useExportCard()
  const { saveCurrentArt } = useSaveArt()

  // Sincroniza rota ↔ store
  useRouteSync()

  // Fecha a biblioteca de templates ao sair de /criar
  useEffect(() => {
    if (activeTab !== 'create') closeTemplateLibrary()
  }, [activeTab, closeTemplateLibrary])

  // Aplica tema no documento
  useEffect(() => {
    const root = document.documentElement
    root.dataset.uiTheme = theme
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    localStorage.setItem('rota-design-ui-theme', theme)
  }, [theme])

  // Expõe helpers de teste em DEV
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as Record<string, unknown>).__testSelectTemplate = (id: string) =>
      useEditorStore.getState().selectTemplate(id)
    ;(window as unknown as Record<string, unknown>).__testSetDarkMode = (dark: boolean) =>
      useEditorStore.setState({ darkMode: dark })
    ;(window as unknown as Record<string, unknown>).__testSetZoom = (zoom: number) =>
      useEditorStore.setState({ zoom: zoom as never })
  }, [])

  // Atalhos de teclado globais
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isTypingTarget =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(e.target.tagName))

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void saveCurrentArt()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        void downloadPNG()
        return
      }
      if (!isTypingTarget && !e.ctrlKey && !e.metaKey && /^[1-6]$/.test(e.key)) {
        const tab = TAB_ORDER[Number(e.key) - 1]
        if (tab) setTab(tab)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveCurrentArt, downloadPNG, setTab])

  // Garante que a key mude nas rotas não-create para acionar AnimatePresence
  const routeKey = location.pathname

  return (
    <div className="flex h-screen flex-col">
      <AppHeader onDownload={downloadPNG} onSave={saveCurrentArt} />
      <CommandPalette
        onTab={setTab}
        onSave={() => { void saveCurrentArt() }}
        onExport={() => { void downloadPNG() }}
      />
      <div className="flex flex-1 overflow-hidden" key={routeKey}>
        <Outlet />
      </div>
    </div>
  )
}
