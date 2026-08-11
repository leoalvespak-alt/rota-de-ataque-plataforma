import { useCallback, useContext } from 'react'
import { toast } from 'sonner'
import { useEditorStore } from '@/stores/useEditorStore'
import { useDecorStore } from '@/stores/useDecorStore'
import { useLibraryStore } from '@/stores/useLibraryStore'
import { captureNodeAsPNG, waitForRenderReady } from '@/lib/export/ExportEngine'
import { ExportNodeRefContext } from '@/lib/export/ExportNodeRefContext'

/**
 * Espelha saveCurrentArt() do Gerador/index.html original (linha 3699).
 * Corrige a auditoria item 12: o original aplicava `canvas.style.transform = 'scale(0.2)'`
 * no próprio #card-canvas sem efeito real (o zoom de verdade era no #preview-wrapper) —
 * aqui a miniatura é gerada com o parâmetro `scale` real do html2canvas (0.2), sem
 * nenhuma manipulação de transform que não fizesse diferença.
 */
export function useSaveArt() {
  const exportNodeRef = useContext(ExportNodeRefContext)
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const elements = useEditorStore((s) => s.elements)
  const darkMode = useEditorStore((s) => s.darkMode)
  const watermark = useDecorStore((s) => s.watermark)
  const texture = useDecorStore((s) => s.texture)
  const addArt = useLibraryStore((s) => s.addArt)

  const saveCurrentArt = useCallback(async () => {
    const node = exportNodeRef.current
    if (!node || !activeTemplateId) return

    const toastId = toast.loading('Gerando miniatura...')
    try {
      await waitForRenderReady(node)
      const thumb = await captureNodeAsPNG(node, { scale: 0.2 })

      addArt({
        templateId: activeTemplateId,
        elements: structuredClone(elements),
        darkMode,
        watermark: structuredClone(watermark),
        texture: structuredClone(texture),
        thumb,
      })

      toast.success('Arte salva com sucesso no Histórico!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar arte.', { id: toastId })
    }
  }, [exportNodeRef, activeTemplateId, elements, darkMode, watermark, texture, addArt])

  return { saveCurrentArt }
}
