import type { TemplateRenderProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { SimpleControls } from '../shared/SimpleControls'

export interface PtCtaElements {
  eyebrow: Hideable<string>
  title: string
  body: string
  cta: Hideable<string>
  bgImg?: string
}

/** Espelha renderCTAPortrait() do Gerador/index.html (linha 2503). */
export function PtCtaRender({ elements: el, dark }: TemplateRenderProps<PtCtaElements>) {
  const hasImg = Boolean(el.bgImg)
  return (
    <div
      className="relative z-3 flex h-full flex-col items-center justify-end gap-8 text-center"
      style={{ padding: '110px 90px' }}
    >
      {hasImg && (
        <img src={el.bgImg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
      )}
      {hasImg && (
        <div
          className="pointer-events-none absolute inset-0 z-1"
          style={{
            background: 'linear-gradient(to bottom,rgba(0,0,0,0.3) 0%,rgba(0,0,0,0.75) 100%)',
          }}
        />
      )}
      {el.eyebrow !== false && (
        <div className="relative z-3">
          <TEyebrow fontSize={28}>
            <EditableText path="eyebrow" value={el.eyebrow} />
          </TEyebrow>
        </div>
      )}
      <div className="relative z-3">
        <TTitle fontSize={100} dark={dark} colorOverride={hasImg ? '#fff' : undefined}>
          <EditableText path="title" value={el.title} />
        </TTitle>
      </div>
      <TRedline width={70} height={6} className="relative z-3" />
      <div className="relative z-3">
        <TBody
          fontSize={40}
          dark={dark}
          colorOverride={hasImg ? 'rgba(255,255,255,0.8)' : undefined}
        >
          <EditableText path="body" value={el.body} />
        </TBody>
      </div>
      {el.cta !== false && (
        <div
          className="relative z-3 mt-4 rounded-xl px-15 py-5.5 font-heading text-4xl font-bold tracking-[0.08em] text-white uppercase"
          style={{ background: 'var(--red)' }}
        >
          <EditableText path="cta" value={el.cta} />
        </div>
      )}
    </div>
  )
}

/** Espelha buildSimpleControls() do Gerador/index.html (linha 2628) — reusado por pt-cta. */
export function PtCtaControls({ elements: el }: { elements: PtCtaElements }) {
  return <SimpleControls el={el} />
}
