import type { TemplateRenderProps, Hideable } from '../types'
import { TEyebrow, TTitle, TRedline, TBody } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { SimpleControls } from '../shared/SimpleControls'

export interface SqChecklistElements {
  eyebrow: Hideable<string>
  title: string
  items: string[]
}

/** Espelha renderChecklistSquare() do Gerador/index.html (linha 2447). */
export function SqChecklistRender({
  elements: el,
  dark,
}: TemplateRenderProps<SqChecklistElements>) {
  const items = Array.isArray(el.items) ? el.items : ['Item 1', 'Item 2', 'Item 3']
  return (
    <div className="relative z-2 flex h-full flex-col gap-6 p-20">
      {el.eyebrow !== false && (
        <TEyebrow fontSize={22}>
          <EditableText path="eyebrow" value={el.eyebrow} />
        </TEyebrow>
      )}
      <TTitle fontSize={70} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline />
      <div className="flex flex-1 flex-col justify-center">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-5.5 py-4.5"
            style={{ borderBottom: '1px solid var(--light-border)' }}
          >
            <div
              className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-lg border-2"
              style={{ borderColor: 'var(--red)' }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C1121F"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <TBody fontSize={30} dark={dark}>
              <EditableText path={`items.${i}`} value={item} />
            </TBody>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Espelha buildSimpleControls() do Gerador/index.html (linha 2628). */
export function SqChecklistControls({ elements: el }: { elements: SqChecklistElements }) {
  return <SimpleControls el={el} />
}
