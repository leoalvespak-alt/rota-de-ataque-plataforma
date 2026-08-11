import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { ControlRow } from '@/features/editor/ControlPanel/ControlRow'
import { ImageUploadField } from '@/features/editor/ControlPanel/ImageUploadField'
import { useImageSlot } from '../useImageSlot'

export interface SqCoverElements {
  eyebrow: Hideable<string>
  title: string
  subtitle: Hideable<string>
  redline: Hideable<boolean>
  bgImg?: string
}

/** Espelha renderCoverSquare() do Gerador/index.html (linha 2106). */
export function SqCoverRender({ elements: el, dark }: TemplateRenderProps<SqCoverElements>) {
  const hasImg = Boolean(el.bgImg)
  return (
    <div className="relative z-[3] flex h-full flex-col items-center justify-center gap-7 p-[90px] text-center">
      {hasImg && (
        <img src={el.bgImg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
      )}
      {hasImg && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: 'linear-gradient(to bottom,rgba(0,0,0,0.35) 0%,rgba(0,0,0,0.6) 100%)',
          }}
        />
      )}
      {el.eyebrow !== false && (
        <div className="relative z-[3]">
          <TEyebrow>
            <EditableText path="eyebrow" value={el.eyebrow} />
          </TEyebrow>
        </div>
      )}
      <div className="relative z-[3]">
        <TTitle fontSize={96} dark={dark} colorOverride={hasImg ? '#fff' : undefined}>
          <EditableText path="title" value={el.title} />
        </TTitle>
      </div>
      {el.redline !== false && <TRedline className="relative z-[3]" />}
      {el.subtitle !== false && (
        <div className="relative z-[3]">
          <TBody
            fontSize={36}
            dark={dark}
            colorOverride={hasImg ? 'rgba(255,255,255,0.85)' : undefined}
          >
            <EditableText path="subtitle" value={el.subtitle} />
          </TBody>
        </div>
      )}
    </div>
  )
}

/** Espelha buildCoverControls() do Gerador/index.html (linha 2722). */
export function SqCoverControls({ elements: el }: TemplateControlsProps<SqCoverElements>) {
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const handleBgImg = useImageSlot('bgImg')

  return (
    <>
      <ControlSection title="Formato">
        <ControlRow label="Fundo (Imagem Opcional)">
          <ImageUploadField onFileSelected={handleBgImg} />
        </ControlRow>
        <ControlToggle
          label="Mostrar Subtítulo"
          checked={el.subtitle !== false}
          onCheckedChange={() => toggleElementVisibility('subtitle')}
        />
        <ControlToggle
          label="Mostrar Eyebrow Tag"
          checked={el.eyebrow !== false}
          onCheckedChange={() => toggleElementVisibility('eyebrow')}
        />
        <ControlToggle
          label="Mostrar Linha Vermelha"
          checked={el.redline !== false}
          onCheckedChange={() => toggleElementVisibility('redline')}
        />
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
