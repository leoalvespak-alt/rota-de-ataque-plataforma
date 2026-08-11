import { useEditorStore } from '@/stores/useEditorStore'
import { useDecorStore, BG_LIBRARY } from '@/stores/useDecorStore'
import { getTemplateById } from '@/features/templates/registry'
import { CanvasFrame } from '@/features/templates/primitives'
import { TextureLayer } from './TextureLayer'
import { WatermarkLayer } from './WatermarkLayer'
import { CardLayoutProvider } from '@/features/editor/layout/cardLayout'

/** Espelha .canvas-area / #preview-wrapper / #card-canvas do Gerador/index.html (linhas 1358-1367). */
export function Canvas() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const elements = useEditorStore((s) => s.elements)
  const darkMode = useEditorStore((s) => s.darkMode)
  const format = useEditorStore((s) => s.format)
  const zoom = useEditorStore((s) => s.zoom)
  const bgLibrarySelected = useDecorStore((s) => s.bgLibrarySelected)

  const tpl = activeTemplateId ? getTemplateById(activeTemplateId) : undefined
  const bg = BG_LIBRARY.find((b) => b.id === bgLibrarySelected)
  const hasUserBg = Boolean((elements as { bgImg?: string }).bgImg)

  return (
    <main
      className="flex flex-1 items-center justify-center overflow-auto p-10"
      style={{
        background: 'var(--workspace-bg)',
        backgroundImage: 'radial-gradient(var(--workspace-dot) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <div
        id="preview-wrapper"
        style={{ transformOrigin: 'center center', transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
      >
        {tpl ? (
          <CanvasFrame
            id="card-canvas-live"
            format={format}
            dark={darkMode}
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          >
            {/* .bg-library-layer — só aplica se o usuário não tiver subido imagem própria */}
            {!hasUserBg && bg && bg.type !== 'none' && (
              <div className="pointer-events-none absolute inset-0 z-0" style={{ background: bg.value }} />
            )}
            {/* key força remontagem completa ao trocar de template — nenhum EditableText
                de um template reaproveita por engano o DOM node de outro (ver EditableText.tsx). */}
            <CardLayoutProvider elements={elements}>
              <tpl.Render key={activeTemplateId} elements={elements as never} dark={darkMode} />
            </CardLayoutProvider>
            <TextureLayer dark={darkMode} />
            <WatermarkLayer dark={darkMode} />
          </CanvasFrame>
        ) : (
          <div className="flex h-40 w-40 items-center justify-center text-sm text-ui-muted">
            Selecione um template
          </div>
        )}
      </div>
    </main>
  )
}
