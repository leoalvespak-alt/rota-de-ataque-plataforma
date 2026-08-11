import type { TemplateRenderProps } from '../types'
import { TEyebrow, TTitle, TRedline, TBody } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { TipControls } from '../shared/TipControls'

export interface PtListElements {
  tag: string
  title: string
  items: string[]
}

/** Espelha renderListPortrait() do Gerador/index.html (linha 2484). */
export function PtListRender({ elements: el, dark }: TemplateRenderProps<PtListElements>) {
  const items = Array.isArray(el.items)
    ? el.items
    : ['Tópico 1', 'Tópico 2', 'Tópico 3', 'Tópico 4']
  return (
    <div className="relative z-2 flex h-full flex-col gap-7.5" style={{ padding: '110px 90px' }}>
      <TEyebrow fontSize={30}>
        <EditableText path="tag" value={el.tag} />
      </TEyebrow>
      <TTitle fontSize={96} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline width={70} height={6} />
      <div className="flex flex-1 flex-col justify-center">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-6 py-5.5"
            style={{ borderBottom: '1px solid var(--light-border)' }}
          >
            <div
              className="min-w-10 shrink-0 font-mono text-4xl font-bold"
              style={{ color: 'var(--red)' }}
            >
              {i + 1}
            </div>
            <TBody fontSize={40} dark={dark} style={{ paddingTop: 4 }}>
              <EditableText path={`items.${i}`} value={item} />
            </TBody>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Espelha buildTipControls() do Gerador/index.html (linha 2772). */
export function PtListControls() {
  return <TipControls />
}
