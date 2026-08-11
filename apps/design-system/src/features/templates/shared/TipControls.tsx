import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'

/**
 * Espelha buildTipControls() do Gerador/index.html (linha 2772) e addTipItem() (linha 3368).
 * Reusado por sq-tip e pt-list (mesma `controls:buildTipControls` no array TEMPLATES original).
 */
export function TipControls() {
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const setElementField = useEditorStore((s) => s.setElementField)
  const elements = useEditorStore((s) => s.elements)

  const handleAddItem = () => {
    const items = Array.isArray(elements.items) ? [...(elements.items as string[])] : []
    items.push('Novo item da lista')
    setElementField(['items'], items)
  }

  return (
    <>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
      <ControlSection title="Adicionar Item">
        <button
          className="w-full justify-center rounded-md border px-3 py-1.5 text-xs"
          style={{ color: 'var(--red)', borderColor: 'rgba(193,18,31,0.3)', background: 'rgba(193,18,31,0.1)' }}
          onClick={handleAddItem}
        >
          + Adicionar item à lista
        </button>
      </ControlSection>
    </>
  )
}
