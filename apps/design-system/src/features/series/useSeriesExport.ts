import { useCallback, useContext } from 'react'
import JSZip from 'jszip'
import { toast } from 'sonner'
import { flushSync } from 'react-dom'
import { useSeriesStore } from '@/stores/useSeriesStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useDecorStore } from '@/stores/useDecorStore'
import { captureNodeAsPNG, waitForRenderReady } from '@/lib/export/ExportEngine'
import { ExportNodeRefContext } from '@/lib/export/ExportNodeRefContext'

/**
 * Espelha exportSeriesZIP() do Gerador/index.html original (linha 3834).
 * Diferença de robustez: o original usava `setTimeout(150ms)` fixo entre slides
 * (comentário "Wait for rendering") — aqui usamos a mesma sequência determinística
 * de `waitForRenderReady` (fonts.ready + img.decode + duplo rAF) usada no export
 * individual, então não depende de um tempo fixo que pode ou não ser suficiente.
 */
export function useSeriesExport() {
  const exportNodeRef = useContext(ExportNodeRefContext)

  const exportSeriesZIP = useCallback(async () => {
    const slides = useSeriesStore.getState().slides
    if (slides.length === 0) return

    const node = exportNodeRef.current
    if (!node) return

    const toastId = toast.loading('Gerando Série... Aguarde.')

    // Backup do estado atual do editor para restaurar ao final.
    const backup = {
      elements: structuredClone(useEditorStore.getState().elements),
      activeTemplateId: useEditorStore.getState().activeTemplateId,
      darkMode: useEditorStore.getState().darkMode,
      watermark: structuredClone(useDecorStore.getState().watermark),
      texture: structuredClone(useDecorStore.getState().texture),
    }

    try {
      const zip = new JSZip()

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]!
        flushSync(() => {
          useEditorStore.getState().selectTemplate(slide.templateId, { keepElements: true })
          useEditorStore.getState().replaceElements(structuredClone(slide.elements), {
            darkMode: slide.darkMode,
          })
          useDecorStore.setState({
            watermark: structuredClone(slide.watermark),
            texture: structuredClone(slide.texture),
          })
        })

        await waitForRenderReady(node)
        const blob = await captureNodeAsPNG(node, { scale: 2 })
        const fileName = `slide-${String(i + 1).padStart(2, '0')}.png`
        zip.file(fileName, blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(zipBlob)
      link.download = `rota-de-ataque-serie-${Date.now()}.zip`
      link.click()
      URL.revokeObjectURL(link.href)

      toast.success('Série exportada com sucesso!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar série.', { id: toastId })
    } finally {
      // Restaura o estado do editor exatamente como estava antes da exportação.
      flushSync(() => {
        if (backup.activeTemplateId) {
          useEditorStore.getState().selectTemplate(backup.activeTemplateId, { keepElements: true })
        }
        useEditorStore.getState().replaceElements(backup.elements, { darkMode: backup.darkMode })
        useDecorStore.setState({ watermark: backup.watermark, texture: backup.texture })
      })
    }
  }, [exportNodeRef])

  return { exportSeriesZIP }
}
