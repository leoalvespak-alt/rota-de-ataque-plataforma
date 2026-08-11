import { useCallback, useContext } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { useEditorStore } from '@/stores/useEditorStore'
import { captureNodeAsPNG, waitForRenderReady } from './ExportEngine'
import { ExportNodeRefContext } from './ExportNodeRefContext'
import { useFeatureFlags } from '@/domain/featureFlags'
import { editorToCard } from '@/domain/adapters'
import { validateCards } from '@/domain/validation'
import { useDecorStore } from '@/stores/useDecorStore'

/**
 * Orquestra a captura determinística (FASE 7):
 * 1. `flushSync` força o React a commitar QUALQUER mudança de estado pendente antes de
 *    prosseguir — sem isso, poderíamos fotografar um frame anterior ao que o usuário vê.
 * 2. `waitForRenderReady` espera fontes + imagens + um paint real (ver ExportEngine.ts).
 * 3. Captura via html2canvas-pro e baixa o PNG.
 *
 * Substitui downloadPNG() do Gerador/index.html original (linha 3399) — mesmo nome de
 * arquivo (`rota-de-ataque-{template}-{timestamp}.png`), mesma escala 2x.
 */
export function useExportCard() {
  const exportNodeRef = useContext(ExportNodeRefContext)
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const texture = useDecorStore((s) => s.texture)
  const watermark = useDecorStore((s) => s.watermark)
  const bgLibrarySelected = useDecorStore((s) => s.bgLibrarySelected)

  const downloadPNG = useCallback(async () => {
    const node = exportNodeRef.current
    if (!node || !activeTemplateId) {
      toast.error('Selecione um template primeiro!')
      return
    }
    if (useFeatureFlags.getState().flags['quality-validator']) {
      const card = editorToCard(useEditorStore.getState(), { texture, watermark, bgLibrarySelected }, 'export-card')
      const result = card ? validateCards([card]) : { valid: false, issues: [{ message: 'Arte indisponível para validação.' }] }
      if (!result.valid) {
        toast.error(result.issues[0]?.message ?? 'A arte tem erros impeditivos.')
        return
      }
    }

    const toastId = toast.loading('Gerando PNG...')
    try {
      flushSync(() => {
        // O próprio ato de ler o ref após um flushSync garante que o commit mais
        // recente do ExportNode (mesmos `elements`/`darkMode` do editor) já aconteceu.
      })
      await waitForRenderReady(node)
      const blob = await captureNodeAsPNG(node, { scale: 2 })

      const link = document.createElement('a')
      link.download = `rota-de-ataque-${activeTemplateId}-${Date.now()}.png`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)

      toast.success('PNG baixado com sucesso!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar PNG. Tente novamente.', { id: toastId })
    }
  }, [exportNodeRef, activeTemplateId, texture, watermark, bgLibrarySelected])

  return { downloadPNG }
}
