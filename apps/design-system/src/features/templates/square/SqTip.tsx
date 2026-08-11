import type { TemplateRenderProps } from '../types'
import { TTag, TTitle, TRedline, TBody } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { TipControls } from '../shared/TipControls'

export interface SqTipElements {
  tag: string
  title: string
  items: string[]
}

/** Espelha renderTipSquare() do Gerador/index.html (linha 2173). */
export function SqTipRender({ elements: el, dark }: TemplateRenderProps<SqTipElements>) {
  const items = Array.isArray(el.items) ? el.items : ['Item 1', 'Item 2', 'Item 3']
  return (
    <div className="relative z-2 flex h-full flex-col gap-7.5 p-22.5">
      <div className="flex items-center gap-5">
        <TTag>
          <EditableText path="tag" value={el.tag} />
        </TTag>
      </div>
      <TTitle fontSize={72} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline />
      <div className="flex flex-1 flex-col justify-center gap-7">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-4.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-xl font-bold text-white"
              style={{ background: 'var(--red)' }}
            >
              {i + 1}
            </div>
            <TBody fontSize={34} dark={dark} style={{ paddingTop: 2 }}>
              <EditableText path={`items.${i}`} value={item} />
            </TBody>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Espelha buildTipControls() do Gerador/index.html (linha 2772) — reusado por pt-list. */
export function SqTipControls() {
  return <TipControls />
}
