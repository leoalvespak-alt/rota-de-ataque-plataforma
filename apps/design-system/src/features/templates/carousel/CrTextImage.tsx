import type { TemplateRenderProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline, TSlot, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useSlotFilePicker } from '../useSlotFilePicker'
import { CrSlideControls, type CrSlideElements } from './CrSlide'

export interface CrTextImageElements extends Omit<CrSlideElements, 'body'> {
  eyebrow: Hideable<string>
  body: string
  main?: string
}

/** Espelha renderCarouselTextImage() do Gerador/index.html (linha 2541). */
export function CrTextImageRender({
  elements: el,
  dark,
}: TemplateRenderProps<CrTextImageElements>) {
  const onSlotClick = useSlotFilePicker()
  return (
    <>
      <div className="relative z-2 flex h-full flex-row">
        <div
          className="flex flex-1 flex-col justify-center gap-5.5"
          style={{ padding: '80px 50px 80px 80px' }}
        >
          {el.eyebrow !== false && (
            <TEyebrow fontSize={22}>
              <EditableText path="eyebrow" value={el.eyebrow} />
            </TEyebrow>
          )}
          <TTitle fontSize={68} dark={dark}>
            <EditableText path="title" value={el.title} />
          </TTitle>
          <TRedline />
          <TBody fontSize={30} dark={dark}>
            <EditableText path="body" value={el.body} />
          </TBody>
        </div>
        <div className="relative w-[400px] shrink-0">
          <TSlot
            slotId="main"
            imageUrl={el.main}
            onClick={onSlotClick}
            dark={dark}
            className="h-full w-full rounded-none"
          />
        </div>
      </div>
      <div className="absolute right-22.5 bottom-22.5 z-5">
        <TPageIndicator fontSize={26}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </>
  )
}

/** Espelha buildCarouselSlideControls() do Gerador/index.html (linha 2811) — reusado por cr-text-image. */
export function CrTextImageControls(props: { elements: CrTextImageElements }) {
  return CrSlideControls(props)
}
