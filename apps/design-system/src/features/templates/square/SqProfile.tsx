import type { TemplateRenderProps } from '../types'
import { TTitle, TBody, TRedline, TSlot } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useSlotFilePicker } from '../useSlotFilePicker'
import { SimpleControls } from '../shared/SimpleControls'

export interface SqProfileElements {
  eyebrow?: unknown
  name: string
  role: string
  quote: string
  avatar?: string
}

/** Espelha renderProfileSquare() do Gerador/index.html (linha 2374). */
export function SqProfileRender({ elements: el, dark }: TemplateRenderProps<SqProfileElements>) {
  const onSlotClick = useSlotFilePicker()
  return (
    <div className="relative z-2 flex h-full flex-col justify-center gap-8 p-22.5">
      <div className="flex items-center gap-5">
        <TSlot
          slotId="avatar"
          imageUrl={el.avatar}
          onClick={onSlotClick}
          dark={dark}
          label="FOTO"
          className="h-20 w-20 shrink-0 rounded-full"
        />
        <div>
          <TTitle fontSize={38} dark={dark}>
            <EditableText path="name" value={el.name} />
          </TTitle>
          <TBody fontSize={26} dark={dark}>
            <EditableText path="role" value={el.role} />
          </TBody>
        </div>
      </div>
      <TRedline />
      {/* Nota de fidelidade: o HTML original também hardcodeia var(--light-text) aqui
          sem regra de dark mode (renderProfileSquare, linha 2389) — mesma inconsistência
          replicada, não introduzida pela migração. */}
      <div
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 38,
          fontWeight: 300,
          color: 'var(--light-text)',
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}
      >
        <EditableText path="quote" value={el.quote} />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-0.75 w-10 shrink-0" style={{ background: 'var(--red)' }} />
        <TBody fontSize={24} dark={dark} style={{ fontWeight: 600 }}>
          Rota de Ataque
        </TBody>
      </div>
    </div>
  )
}

/** Espelha buildSimpleControls() do Gerador/index.html (linha 2628). */
export function SqProfileControls({ elements: el }: { elements: SqProfileElements }) {
  return <SimpleControls el={el} />
}
