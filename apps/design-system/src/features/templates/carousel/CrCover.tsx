import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { ControlRow } from '@/features/editor/ControlPanel/ControlRow'
import { ImageUploadField } from '@/features/editor/ControlPanel/ImageUploadField'
import { useImageSlot } from '../useImageSlot'
import { CarouselNavSection } from '../shared/CarouselNavSection'

export interface CrCoverElements {
  eyebrow: Hideable<string>
  title: string
  subtitle: Hideable<string>
  page: string
  bgImg?: string
}

/** Espelha renderCarouselCover() do Gerador/index.html (linha 2269). */
export function CrCoverRender({ elements: el, dark }: TemplateRenderProps<CrCoverElements>) {
  const hasImg = Boolean(el.bgImg)
  return (
    <>
      <div className="relative z-3 flex h-full flex-col items-start justify-end gap-7 p-[90px]">
        {hasImg && (
          <img src={el.bgImg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
        )}
        {hasImg && (
          <div
            className="pointer-events-none absolute inset-0 z-1"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          />
        )}
        {el.eyebrow !== false && (
          <div className="relative z-3">
            <TEyebrow fontSize={24}>
              <EditableText path="eyebrow" value={el.eyebrow} />
            </TEyebrow>
          </div>
        )}
        <div className="relative z-3">
          <TTitle fontSize={86} dark={dark} colorOverride={hasImg ? '#fff' : undefined}>
            <EditableText path="title" value={el.title} />
          </TTitle>
        </div>
        <TRedline className="relative z-3" />
        {el.subtitle !== false && (
          <div className="relative z-3">
            <TBody
              fontSize={34}
              dark={dark}
              colorOverride={hasImg ? 'rgba(255,255,255,0.8)' : undefined}
            >
              <EditableText path="subtitle" value={el.subtitle} />
            </TBody>
          </div>
        )}
      </div>
      <div className="absolute right-[90px] bottom-[90px] z-5">
        <TPageIndicator fontSize={28}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </>
  )
}

/** Espelha buildCarouselCoverControls() do Gerador/index.html (linha 2797). */
export function CrCoverControls({ elements: el }: TemplateControlsProps<CrCoverElements>) {
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
          label="Mostrar Eyebrow"
          checked={el.eyebrow !== false}
          onCheckedChange={() => toggleElementVisibility('eyebrow')}
        />
      </ControlSection>
      <CarouselNavSection />
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
