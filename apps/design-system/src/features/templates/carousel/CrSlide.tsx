import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { CarouselNavSection } from '../shared/CarouselNavSection'

export interface CrSlideElements {
  eyebrow: Hideable<string>
  title: string
  body: string
  page: string
}

/** Espelha renderCarouselSlide() do Gerador/index.html (linha 2291). */
export function CrSlideRender({ elements: el, dark }: TemplateRenderProps<CrSlideElements>) {
  return (
    <div className="relative z-2 flex h-full flex-col gap-6 p-22.5">
      {el.eyebrow !== false && (
        <TEyebrow fontSize={24}>
          <EditableText path="eyebrow" value={el.eyebrow} />
        </TEyebrow>
      )}
      <TTitle fontSize={78} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline />
      <TBody fontSize={34} dark={dark} style={{ flex: 1, whiteSpace: 'pre-line' }}>
        <EditableText path="body" value={el.body} />
      </TBody>
      <div className="flex justify-end">
        <TPageIndicator fontSize={26}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </div>
  )
}

/**
 * Espelha buildCarouselSlideControls() do Gerador/index.html (linha 2811).
 * Reusado por cr-text-image, cr-list, cr-fact, cr-comparison (mesma lista de
 * `controls:buildCarouselSlideControls` no array TEMPLATES original).
 */
export function CrSlideControls<E extends object>({ elements: el }: TemplateControlsProps<E>) {
  const eyebrow = (el as { eyebrow?: unknown }).eyebrow
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)

  return (
    <>
      <ControlSection title="Elementos">
        <ControlToggle
          label="Mostrar Eyebrow"
          checked={eyebrow !== false}
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
