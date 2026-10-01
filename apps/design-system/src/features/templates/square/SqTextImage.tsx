import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TSlot } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { ControlRow } from '@/features/editor/ControlPanel/ControlRow'
import { ImageUploadField } from '@/features/editor/ControlPanel/ImageUploadField'
import { useImageSlot } from '../useImageSlot'
import { useSlotFilePicker } from '../useSlotFilePicker'

export interface SqTextImageElements {
  eyebrow: Hideable<string>
  title: string
  body: string
  main?: string
}

/** Espelha renderTextImageSquare() do Gerador/index.html (linha 2125). */
export function SqTextImageRender({
  elements: el,
  dark,
}: TemplateRenderProps<SqTextImageElements>) {
  const onSlotClick = useSlotFilePicker()
  return (
    <div className="relative z-2 flex h-full flex-row">
      <div
        className="flex flex-1 flex-col justify-center gap-6"
        style={{ padding: '80px 50px 80px 80px' }}
      >
        {el.eyebrow !== false && (
          <TEyebrow fontSize={24}>
            <EditableText path="eyebrow" value={el.eyebrow} />
          </TEyebrow>
        )}
        <TTitle fontSize={72} dark={dark}>
          <EditableText path="title" value={el.title} />
        </TTitle>
        <TBody fontSize={32} dark={dark}>
          <EditableText path="body" value={el.body} />
        </TBody>
      </div>
      <div className="w-[420px] shrink-0">
        <TSlot
          slotId="main"
          imageUrl={el.main}
          onClick={onSlotClick}
          dark={dark}
          className="h-full w-full rounded-none"
        />
      </div>
    </div>
  )
}

/**
 * Espelha buildTextImageControls() do Gerador/index.html (linha 2736).
 * Reusado também por pt-image, que compartilha os controles de imagem e eyebrow.
 */
export function SqTextImageControls<E extends { eyebrow?: unknown }>({
  elements: el,
}: TemplateControlsProps<E>) {
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const handleMain = useImageSlot('main')

  return (
    <>
      <ControlSection title="Imagem">
        <ControlRow label="Substituir Imagem">
          <ImageUploadField onFileSelected={handleMain} />
        </ControlRow>
        <ControlToggle
          label="Mostrar Eyebrow Tag"
          checked={el.eyebrow !== false}
          onCheckedChange={() => toggleElementVisibility('eyebrow')}
        />
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
