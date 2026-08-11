import type { TemplateRenderProps, Hideable } from '../types'
import { TEyebrow, TTitle, TRedline, TBody, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { CrSlideControls } from './CrSlide'

export interface CrListElements {
  eyebrow: Hideable<string>
  title: string
  steps: string[]
  page: string
}

/** Espelha renderCarouselList() do Gerador/index.html (linha 2562). */
export function CrListRender({ elements: el, dark }: TemplateRenderProps<CrListElements>) {
  const steps = Array.isArray(el.steps) ? el.steps : ['Passo 1', 'Passo 2', 'Passo 3', 'Passo 4']
  return (
    <div className="relative z-2 flex h-full flex-col gap-5.5 p-20">
      {el.eyebrow !== false && (
        <TEyebrow fontSize={22}>
          <EditableText path="eyebrow" value={el.eyebrow} />
        </TEyebrow>
      )}
      <TTitle fontSize={68} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline />
      <div className="flex flex-1 flex-col justify-center gap-4.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-5">
            <div
              className="min-w-11.5 shrink-0 text-right font-mono text-[44px] leading-none font-bold"
              style={{ color: 'var(--red)' }}
            >
              0{i + 1}
            </div>
            <TBody fontSize={28} dark={dark} style={{ paddingTop: 6 }}>
              <EditableText path={`steps.${i}`} value={s} />
            </TBody>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <TPageIndicator fontSize={26}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </div>
  )
}

/** Espelha buildCarouselSlideControls() do Gerador/index.html (linha 2811) — reusado por cr-list. */
export function CrListControls(props: { elements: CrListElements }) {
  return CrSlideControls(props)
}
