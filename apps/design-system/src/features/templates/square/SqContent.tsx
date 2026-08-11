import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TBody, TRedline } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'

export interface SqContentElements {
  eyebrow: Hideable<string>
  title: string
  body: string
  redline: Hideable<boolean>
}

/** Espelha renderContentSquare() do Gerador/index.html (linha 2143). */
export function SqContentRender({ elements: el, dark }: TemplateRenderProps<SqContentElements>) {
  return (
    <div className="relative z-[2] flex h-full flex-col justify-center gap-[30px] p-[90px]">
      {el.eyebrow !== false && (
        <TEyebrow fontSize={24}>
          <EditableText path="eyebrow" value={el.eyebrow} />
        </TEyebrow>
      )}
      <TTitle fontSize={80} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      {el.redline !== false && <TRedline />}
      <TBody fontSize={34} dark={dark} style={{ whiteSpace: 'pre-line' }}>
        <EditableText path="body" value={el.body} />
      </TBody>
    </div>
  )
}

/** Espelha buildContentControls() do Gerador/index.html (linha 2749). */
export function SqContentControls({ elements: el }: TemplateControlsProps<SqContentElements>) {
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
