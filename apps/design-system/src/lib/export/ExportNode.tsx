import { forwardRef } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'
import { useDecorStore, BG_LIBRARY } from '@/stores/useDecorStore'
import { getTemplateById } from '@/features/templates/registry'
import { CanvasFrame } from '@/features/templates/primitives'
import { TextureLayer } from '@/features/editor/Canvas/TextureLayer'
import { WatermarkLayer } from '@/features/editor/Canvas/WatermarkLayer'

/**
 * Nó de export dedicado, sempre em escala 1:1 real (nunca afetado pelo zoom do editor),
 * renderizado fora da tela (`position: fixed; left: -99999px`). Nunca visível ao usuário,
 * mas sempre montado — assim o React nunca precisa "esperar" um mount, só um commit.
 *
 * Isso resolve o ponto de risco #2 do plano: como o zoom do editor só afeta o
 * `#preview-wrapper` visível (ver Canvas.tsx), este nó nunca herda nenhuma transformação
 * de zoom, então o `scale` passado ao html2canvas é sempre o único fator de escala real.
 */
export const ExportNode = forwardRef<HTMLDivElement>(function ExportNode(_props, ref) {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const elements = useEditorStore((s) => s.elements)
  const darkMode = useEditorStore((s) => s.darkMode)
  const format = useEditorStore((s) => s.format)
  const bgLibrarySelected = useDecorStore((s) => s.bgLibrarySelected)

  const tpl = activeTemplateId ? getTemplateById(activeTemplateId) : undefined
  const bg = BG_LIBRARY.find((b) => b.id === bgLibrarySelected)
  const hasUserBg = Boolean((elements as { bgImg?: string }).bgImg)

  if (!tpl) return null

  return (
    <div
      style={{ position: 'fixed', top: 0, left: -99999, pointerEvents: 'none' }}
      aria-hidden
    >
      <div ref={ref}>
        <CanvasFrame id="card-canvas" format={format} dark={darkMode}>
          {!hasUserBg && bg && bg.type !== 'none' && (
            <div className="pointer-events-none absolute inset-0 z-0" style={{ background: bg.value }} />
          )}
          <tpl.Render elements={elements as never} dark={darkMode} exportMode />
          <TextureLayer dark={darkMode} />
          <WatermarkLayer dark={darkMode} />
        </CanvasFrame>
      </div>
    </div>
  )
})
