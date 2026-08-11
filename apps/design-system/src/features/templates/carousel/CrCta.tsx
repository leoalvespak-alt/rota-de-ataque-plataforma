import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TTitle, TBody, TRedline, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { CarouselNavSection } from '../shared/CarouselNavSection'

export interface CrCtaElements {
  title: string
  body: string
  cta: Hideable<string>
  page: string
}

/** Espelha renderCarouselCTA() do Gerador/index.html (linha 2309). */
export function CrCtaRender({ elements: el, dark }: TemplateRenderProps<CrCtaElements>) {
  return (
    <div className="relative z-2 flex h-full flex-col items-center justify-center gap-9 p-22.5 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'var(--red)' }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <TTitle fontSize={86} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline width={80} />
      <TBody fontSize={36} dark={dark}>
        <EditableText path="body" value={el.body} />
      </TBody>
      {el.cta !== false && (
        <div
          className="mt-2.5 rounded-[10px] px-12.5 py-4.5 font-heading text-[30px] font-bold tracking-[0.08em] text-white uppercase"
          style={{ background: 'var(--red)' }}
        >
          <EditableText path="cta" value={el.cta} />
        </div>
      )}
      <div className="absolute right-22.5 bottom-22.5">
        <TPageIndicator fontSize={26}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </div>
  )
}

/** Espelha buildCTAControls() do Gerador/index.html (linha 2823). */
export function CrCtaControls({ elements: el }: TemplateControlsProps<CrCtaElements>) {
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)

  return (
    <>
      <ControlSection title="Elementos">
        <ControlToggle
          label="Mostrar Botão CTA"
          checked={el.cta !== false}
          onCheckedChange={() => toggleElementVisibility('cta')}
        />
      </ControlSection>
      <CarouselNavSection />
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
