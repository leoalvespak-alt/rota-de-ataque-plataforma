import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { ControlRow } from '@/features/editor/ControlPanel/ControlRow'
import { ImageUploadField } from '@/features/editor/ControlPanel/ImageUploadField'
import { useImageSlot } from '../useImageSlot'

export interface PtCoverElements {
  eyebrow: Hideable<string>
  title: string
  subtitle: Hideable<string>
  redline?: Hideable<boolean>
  bgImg?: string
}

/** Espelha renderCoverPortrait() do Gerador/index.html (linha 2217). */
export function PtCoverRender({ elements: el, dark }: TemplateRenderProps<PtCoverElements>) {
  const hasImg = Boolean(el.bgImg)
  return (
    <div className="relative z-[3] flex h-full flex-col justify-end gap-6 p-[90px]">
      {hasImg ? (
        <img src={el.bgImg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute top-0 left-0 z-0 h-[65%] w-full"
          style={{ background: 'var(--light-slot)' }}
        />
      )}
      {hasImg && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: 'linear-gradient(to bottom,rgba(0,0,0,0.2) 40%,rgba(0,0,0,0.85) 100%)',
          }}
        />
      )}
      {el.eyebrow !== false && (
        <div className="relative z-[3]">
          <TEyebrow fontSize={30}>
            <EditableText path="eyebrow" value={el.eyebrow} />
          </TEyebrow>
        </div>
      )}
      <div className="relative z-[3]">
        <TTitle fontSize={110} dark={dark} colorOverride={hasImg ? '#fff' : undefined}>
          <EditableText path="title" value={el.title} />
        </TTitle>
      </div>
      <TRedline className="relative z-[3]" />
      {el.subtitle !== false && (
        <div className="relative z-[3]">
          <TBody
            fontSize={44}
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

/** Espelha buildCoverControls() do Gerador/index.html (linha 2722) — reusado por pt-cover. */
export function PtCoverControls({ elements: el }: TemplateControlsProps<PtCoverElements>) {
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
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
