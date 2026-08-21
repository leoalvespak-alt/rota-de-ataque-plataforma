/**
 * CreateTab — conteúdo da rota /criar, extraído do AppShell.
 * Mantém a mesma estrutura original (Gallery, Canvas, ControlPanel, SeriesBar).
 */
import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Gallery } from '@/features/editor/Gallery/Gallery'
import { TemplateLibraryView } from '@/features/editor/Gallery/TemplateLibraryView'
import { Canvas } from '@/features/editor/Canvas/Canvas'
import { ControlPanel } from '@/features/editor/ControlPanel/ControlPanel'
import { SeriesBar } from '@/features/series/SeriesBar'
import { useUiStore } from '@/stores/useUiStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { TEMPLATES } from '@/features/templates/registry'
import { useTemplateLibraryStore } from '@/stores/useTemplateLibraryStore'
import { cn } from '@/lib/utils'

export function CreateTab() {
  const closePanels = useUiStore((s) => s.closePanels)
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen)
  const templateLibraryOpen = useTemplateLibraryStore((s) => s.isOpen)
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const selectTemplate = useEditorStore((s) => s.selectTemplate)

  useEffect(() => {
    if (!activeTemplateId && TEMPLATES.length > 0) {
      selectTemplate(TEMPLATES[0]!.id)
    }
  }, [activeTemplateId, selectTemplate])

  return (
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
  )
}
