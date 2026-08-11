import type { TemplateRenderProps, TemplateControlsProps } from '../types'
import { TRedline, TBody } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { SimpleControls } from '../shared/SimpleControls'

export interface PtQuoteElements {
  quote: string
  author: string
  sub?: string
  bgImg?: string
}

/** Espelha renderQuotePortrait() do Gerador/index.html (linha 2468). */
export function PtQuoteRender({ elements: el, dark }: TemplateRenderProps<PtQuoteElements>) {
  return (
    <div
      className="relative z-2 flex h-full flex-col items-center justify-center gap-10 text-center"
      style={{ padding: '110px 90px' }}
    >
      <div
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 160,
          color: 'var(--red)',
          lineHeight: 0.6,
          fontWeight: 700,
          opacity: 0.4,
        }}
      >
        &ldquo;
      </div>
      {/* Nota de fidelidade: a quote é sempre var(--light-text) hardcoded no original
          (renderQuotePortrait, linha 2474) — diferente de sq-quote, aqui não usa .t-title,
          então não reage ao dark mode no app original. Replicado tal como é. */}
      <div
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 58,
          fontWeight: 300,
          lineHeight: 1.45,
          color: 'var(--light-text)',
        }}
      >
        <EditableText path="quote" value={el.quote} />
      </div>
      <div className="flex flex-col items-center gap-3.5">
        <TRedline width={70} height={5} />
        <TBody fontSize={36} dark={dark} style={{ fontWeight: 600 }}>
          <EditableText path="author" value={el.author} />
        </TBody>
        <TBody fontSize={30} dark={dark}>
          <EditableText path="sub" value={el.sub ?? ''} />
        </TBody>
      </div>
    </div>
  )
}

/** Espelha buildSimpleControls() do Gerador/index.html (linha 2628) — reusado por pt-quote. */
export function PtQuoteControls({ elements: el }: TemplateControlsProps<PtQuoteElements>) {
  return <SimpleControls el={el} />
}
