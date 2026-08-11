import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'

export interface PtContentElements {
  eyebrow: Hideable<string>
  title: string
  body: string
}

/** Espelha renderContentPortrait() do Gerador/index.html (linha 2236). */
export function PtContentRender({ elements: el, dark }: TemplateRenderProps<PtContentElements>) {
  return (
    <div
      className="relative z-[2] flex h-full flex-col justify-center gap-[38px]"
      style={{ padding: '110px 90px' }}
    >
      {el.eyebrow !== false && (
        <TEyebrow fontSize={30}>
          <EditableText path="eyebrow" value={el.eyebrow} />
        </TEyebrow>
      )}
      <TTitle fontSize={100} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline width={80} height={6} />
      <TBody fontSize={44} dark={dark}>
        <EditableText path="body" value={el.body} />
      </TBody>
    </div>
  )
}

/** Espelha buildContentControls() do Gerador/index.html (linha 2749) — reusado por pt-content. */
export function PtContentControls({ elements: el }: TemplateControlsProps<PtContentElements>) {
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)

  return (
    <>
      <ControlSection title="Elementos">
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
