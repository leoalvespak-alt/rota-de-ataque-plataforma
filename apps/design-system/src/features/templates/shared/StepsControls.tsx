import type { Hideable } from '../types'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'

/**
 * Espelha buildStepsControls() do Gerador/index.html (linha 2643) e addStep() (linha 2657).
 * Reusado por sq-steps (cr-list usa buildCarouselSlideControls, não este).
 */
export function StepsControls({ el }: { el: { eyebrow?: Hideable<string> } }) {
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const setElementField = useEditorStore((s) => s.setElementField)
  const elements = useEditorStore((s) => s.elements)

  const handleAddStep = () => {
    const steps = Array.isArray(elements.steps) ? [...(elements.steps as string[])] : []
    steps.push('Novo passo')
    setElementField(['steps'], steps)
  }

  return (
    <>
      <ControlSection title="Elementos">
        <ControlToggle
          label="Mostrar Eyebrow"
          checked={el.eyebrow !== false}
          onCheckedChange={() => toggleElementVisibility('eyebrow')}
        />
      </ControlSection>
      <ControlSection title="Passos">
        <button
          className="rounded-md border border-dashed px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--ui-border)', color: 'var(--red)' }}
          onClick={handleAddStep}
        >
          + Adicionar passo
        </button>
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
