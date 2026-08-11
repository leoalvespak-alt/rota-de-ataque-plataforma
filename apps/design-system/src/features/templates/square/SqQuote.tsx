import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TRedline, TBody, TTitle } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'

export interface SqQuoteElements {
  quote: string
  author: Hideable<string>
}

/** Espelha renderQuoteSquare() do Gerador/index.html (linha 2156). */
export function SqQuoteRender({ elements: el, dark }: TemplateRenderProps<SqQuoteElements>) {
  return (
    <div className="relative z-[2] flex h-full flex-col items-center justify-center gap-10 p-[90px] text-center">
      <div
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 120,
          color: 'var(--red)',
          lineHeight: 0.6,
          fontWeight: 700,
          alignSelf: 'flex-start',
          opacity: 0.5,
        }}
      >
        "
      </div>
      {/* Espelha .t-title reaproveitado para a quote (renderQuoteSquare, linha 2162) —
          usa TTitle (que já reage a `dark`) com override tipográfico em vez de estilo solto. */}
      <TTitle
        dark={dark}
        fontSize={60}
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 600,
          textTransform: 'none',
          letterSpacing: '0.01em',
        }}
      >
        <EditableText path="quote" value={el.quote} />
      </TTitle>
      {el.author !== false && (
        <div className="flex flex-col items-center gap-2.5">
          <TRedline />
          <TBody fontSize={28} dark={dark} style={{ fontWeight: 600 }}>
            <EditableText path="author" value={el.author} />
          </TBody>
        </div>
      )}
    </div>
  )
}

/** Espelha buildQuoteControls() do Gerador/index.html (linha 2761) — já corrigido pela auditoria (item 4). */
export function SqQuoteControls({ elements: el }: TemplateControlsProps<SqQuoteElements>) {
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)

  return (
    <>
      <ControlSection title="Elementos">
        <ControlToggle
          label="Mostrar Autor"
          checked={el.author !== false}
          onCheckedChange={() => toggleElementVisibility('author')}
        />
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
