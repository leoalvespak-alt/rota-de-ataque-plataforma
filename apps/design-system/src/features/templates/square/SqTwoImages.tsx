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

export interface SqTwoImagesElements {
  eyebrow: Hideable<string>
  title: string
  body: string
  slot1?: string
  slot2?: string
}

/** Espelha renderTwoImagesSquare() do Gerador/index.html (linha 2197). */
export function SqTwoImagesRender({
  elements: el,
  dark,
}: TemplateRenderProps<SqTwoImagesElements>) {
  const onSlotClick = useSlotFilePicker()
  return (
    <div className="relative z-2 flex h-full flex-col gap-7 p-20">
      <div className="flex items-center gap-4">
        {el.eyebrow !== false && (
          <TEyebrow fontSize={22}>
            <EditableText path="eyebrow" value={el.eyebrow} />
          </TEyebrow>
        )}
      </div>
      <TTitle fontSize={70} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <div className="flex flex-1 gap-5">
        <TSlot
          slotId="slot1"
          imageUrl={el.slot1}
          onClick={onSlotClick}
          dark={dark}
          className="flex-1 rounded-xl"
        />
        <TSlot
          slotId="slot2"
          imageUrl={el.slot2}
          onClick={onSlotClick}
          dark={dark}
          className="flex-1 rounded-xl"
        />
      </div>
      <TBody fontSize={30} dark={dark}>
        <EditableText path="body" value={el.body} />
      </TBody>
    </div>
  )
}

/** Espelha buildTwoImagesControls() do Gerador/index.html (linha 2784). */
export function SqTwoImagesControls({ elements: el }: TemplateControlsProps<SqTwoImagesElements>) {
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const handleSlot1 = useImageSlot('slot1')
  const handleSlot2 = useImageSlot('slot2')

  return (
    <>
      <ControlSection title="Imagens">
        <ControlRow label="Imagem Esquerda">
          <ImageUploadField onFileSelected={handleSlot1} />
        </ControlRow>
        <ControlRow label="Imagem Direita">
          <ImageUploadField onFileSelected={handleSlot2} />
        </ControlRow>
        <ControlToggle
          label="Mostrar Eyebrow"
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
