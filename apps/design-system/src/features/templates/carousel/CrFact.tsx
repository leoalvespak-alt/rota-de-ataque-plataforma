import type { TemplateRenderProps, Hideable } from '../types'
import { TTag, TRedline, TBody, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { CrSlideControls } from './CrSlide'

export interface CrFactElements {
  tag: Hideable<string>
  big: string
  label: string
  page: string
}

/** Espelha renderCarouselFact() do Gerador/index.html (linha 2584). */
export function CrFactRender({ elements: el, dark }: TemplateRenderProps<CrFactElements>) {
  return (
    <div className="relative z-2 flex h-full flex-col items-center justify-center gap-7 p-22.5 text-center">
      {el.tag !== false && (
        <TTag>
          <EditableText path="tag" value={el.tag} />
        </TTag>
      )}
      <div
        className="font-mono text-[200px] leading-[0.9] font-bold"
        style={{ color: 'var(--red)' }}
      >
        <EditableText path="big" value={el.big} />
      </div>
      <TRedline width={80} />
      <TBody fontSize={38} dark={dark}>
        <EditableText path="label" value={el.label} />
      </TBody>
      <div className="absolute right-22.5 bottom-22.5">
        <TPageIndicator fontSize={26}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </div>
  )
}

/**
 * Espelha buildCarouselSlideControls() do Gerador/index.html (linha 2811) — reusado por cr-fact.
 * Nota de fidelidade: cr-fact usa `tag`, não `eyebrow` — o toggle "Mostrar Eyebrow" do
 * controle compartilhado não afeta nada aqui (mesmo comportamento inócuo do original).
 */
export function CrFactControls(props: { elements: CrFactElements }) {
  return CrSlideControls(props)
}
