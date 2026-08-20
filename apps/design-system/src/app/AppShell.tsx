import { lazy, Suspense, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AppHeader } from './AppHeader'
import { Gallery } from '@/features/editor/Gallery/Gallery'
import { TemplateLibraryView } from '@/features/editor/Gallery/TemplateLibraryView'
import { Canvas } from '@/features/editor/Canvas/Canvas'
import { ControlPanel } from '@/features/editor/ControlPanel/ControlPanel'
import { SeriesBar } from '@/features/series/SeriesBar'
import { useUiStore, type AppTab } from '@/stores/useUiStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { TEMPLATES } from '@/features/templates/registry'
import { useExportCard } from '@/lib/export/useExportCard'
import { useSaveArt } from '@/features/history/useSaveArt'
import { cn } from '@/lib/utils'
import { CommandPalette } from '@/features/commands/CommandPalette'
import { useTemplateLibraryStore } from '@/stores/useTemplateLibraryStore'

const TAB_ORDER: AppTab[] = ['dashboard', 'brand', 'ai-config', 'renders', 'history', 'editorial']

const DashboardView = lazy(() =>
  import('@/features/dashboard/DashboardView').then((module) => ({ default: module.DashboardView })),
)
const BrandView = lazy(() =>
  import('@/features/brand/BrandView').then((module) => ({ default: module.BrandView })),
)
const AIConfigView = lazy(() =>
  import('@/features/ai/AIConfigView').then((module) => ({ default: module.AIConfigView })),
)
const RendersView = lazy(() =>
  import('@/features/renders/RendersView').then((module) => ({ default: module.RendersView })),
)
const HistoryView = lazy(() =>
  import('@/features/history/HistoryView').then((module) => ({ default: module.HistoryView })),
)
const EditorialView = lazy(() =>
  import('@/features/editorial/EditorialView').then((module) => ({
    default: module.EditorialView,
  })),
)
const WizardView = lazy(() =>
  import('@/features/wizard/WizardView').then((module) => ({ default: module.WizardView })),
)

const TabLoading = () => (
  <div className="flex flex-1 items-center justify-center text-sm text-ui-muted">Carregando…</div>
)

export function AppShell() {
  const activeTab = useUiStore((s) => s.activeTab)
  const theme = useUiStore((s) => s.theme)
  const setTab = useUiStore((s) => s.setTab)
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen)
  const closePanels = useUiStore((s) => s.closePanels)
  const templateLibraryOpen = useTemplateLibraryStore((s) => s.isOpen)
  const closeTemplateLibrary = useTemplateLibraryStore((s) => s.closeLibrary)
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const selectTemplate = useEditorStore((s) => s.selectTemplate)
  const undo = () => useEditorStore.temporal.getState().undo()
  const redo = () => useEditorStore.temporal.getState().redo()
  const { downloadPNG } = useExportCard()
  const { saveCurrentArt } = useSaveArt()

  useEffect(() => {
    if (!activeTemplateId && TEMPLATES.length > 0) {
      selectTemplate(TEMPLATES[0]!.id)
    }
  }, [activeTemplateId, selectTemplate])

  useEffect(() => {
    if (activeTab !== 'create') closeTemplateLibrary()
  }, [activeTab, closeTemplateLibrary])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.uiTheme = theme
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    localStorage.setItem('rota-design-ui-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as Record<string, unknown>).__testSelectTemplate = (id: string) =>
      useEditorStore.getState().selectTemplate(id)
    ;(window as unknown as Record<string, unknown>).__testSetDarkMode = (dark: boolean) =>
      useEditorStore.setState({ darkMode: dark })
    ;(window as unknown as Record<string, unknown>).__testSetZoom = (zoom: number) =>
      useEditorStore.setState({ zoom: zoom as never })
  }, [])

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

  return (
    <div className="flex h-screen flex-col">
      <AppHeader onDownload={downloadPNG} onSave={saveCurrentArt} />
      <CommandPalette
        onTab={setTab}
        onSave={() => {
          void saveCurrentArt()
        }}
        onExport={() => {
          void downloadPNG()
        }}
      />

      {activeTab === 'dashboard' && (
        <div className="flex flex-1 overflow-hidden">
          <Suspense fallback={<TabLoading />}><DashboardView /></Suspense>
        </div>
      )}

      {activeTab === 'wizard' && (
        <div className="flex flex-1 overflow-hidden">
          <Suspense fallback={<TabLoading />}><WizardView /></Suspense>
        </div>
      )}

      <AnimatePresence mode="wait">

        {activeTab === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative flex flex-1 overflow-hidden"
          >
            {templateLibraryOpen ? (
              <TemplateLibraryView />
            ) : (
              <>
                <div className="hidden xl:flex">
                  <Gallery />
                </div>
                {(leftPanelOpen || rightPanelOpen) && (
                  <button
                    aria-label="Fechar painéis"
                    className="fixed inset-0 z-30 bg-black/60 xl:hidden"
                    onClick={closePanels}
                  />
                )}
                <div
                  className={cn(
                    'fixed top-[96px] bottom-0 left-0 z-40 flex max-w-[88vw] shadow-2xl transition-transform duration-200 md:top-13 xl:hidden',
                    leftPanelOpen ? 'translate-x-0' : '-translate-x-full',
                  )}
                >
                  <Gallery />
                </div>
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <SeriesBar />
                  <Canvas />
                </div>
                <div className="hidden xl:flex">
                  <ControlPanel />
                </div>
                <div
                  className={cn(
                    'fixed top-[96px] right-0 bottom-0 z-40 flex max-w-[88vw] shadow-2xl transition-transform duration-200 md:top-13 xl:hidden',
                    rightPanelOpen ? 'translate-x-0' : 'translate-x-full',
                  )}
                >
                  <ControlPanel />
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'brand' && (
          <motion.div key="brand" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 overflow-hidden">
            <Suspense fallback={<TabLoading />}><BrandView /></Suspense>
          </motion.div>
        )}
        {activeTab === 'ai-config' && (
          <motion.div key="ai-config" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 overflow-hidden">
            <Suspense fallback={<TabLoading />}><AIConfigView /></Suspense>
          </motion.div>
        )}
        {activeTab === 'renders' && (
          <motion.div key="renders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 overflow-hidden">
            <Suspense fallback={<TabLoading />}><RendersView /></Suspense>
          </motion.div>
        )}
        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 overflow-hidden">
            <Suspense fallback={<TabLoading />}><HistoryView /></Suspense>
          </motion.div>
        )}
        {activeTab === 'editorial' && (
          <motion.div key="editorial" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 overflow-hidden">
            <Suspense fallback={<TabLoading />}><EditorialView /></Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
