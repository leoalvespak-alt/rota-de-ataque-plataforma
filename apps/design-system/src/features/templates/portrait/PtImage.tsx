import type { TemplateRenderProps, TemplateControlsProps } from '../types'
import { TEyebrow, TTitle, TBody, TRedline, TSlot } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useSlotFilePicker } from '../useSlotFilePicker'
import { SqTextImageControls, type SqTextImageElements } from '../square/SqTextImage'

export type PtImageElements = Omit<SqTextImageElements, 'redline'>

/** Espelha renderImagePortrait() do Gerador/index.html (linha 2249). */
export function PtImageRender({ elements: el, dark }: TemplateRenderProps<PtImageElements>) {
  const onSlotClick = useSlotFilePicker()
  return (
    <div className="relative z-2 flex h-full flex-col">
      <div className="basis-[55%]">
        <TSlot
          slotId="main"
          imageUrl={el.main}
          onClick={onSlotClick}
          dark={dark}
          className="h-full w-full rounded-none"
        />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-7" style={{ padding: '70px 90px' }}>
        {el.eyebrow !== false && (
          <TEyebrow fontSize={28}>
            <EditableText path="eyebrow" value={el.eyebrow} />
          </TEyebrow>
        )}
        <TTitle fontSize={90} dark={dark}>
          <EditableText path="title" value={el.title} />
        </TTitle>
        <TRedline />
        <TBody fontSize={40} dark={dark}>
          <EditableText path="body" value={el.body} />
        </TBody>
      </div>
    </div>
  )
}

/** Espelha buildTextImageControls() do Gerador/index.html (linha 2736) — reusado por pt-image. */
export function PtImageControls(props: TemplateControlsProps<PtImageElements>) {
  return SqTextImageControls(props)
}
