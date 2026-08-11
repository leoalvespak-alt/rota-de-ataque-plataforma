import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { ControlRow } from '@/features/editor/ControlPanel/ControlRow'
import { ImageUploadField } from '@/features/editor/ControlPanel/ImageUploadField'
import { useImageSlot } from '../useImageSlot'

/**
 * Espelha buildSimpleControls() do Gerador/index.html (linha 2628).
 * Reusado pelos templates: sq-stats, sq-profile, sq-checklist, pt-quote, pt-cta
 * (mesma lista de `controls:buildSimpleControls` no array TEMPLATES original).
 *
 * Nota de fidelidade: o toggle "Mostrar Eyebrow/Tag" é renderizado mesmo em templates
 * que não têm esse campo (ex: pt-quote) — no app original ele existe mas não afeta nada
 * nesses casos, e essa auditoria decidiu replicar fielmente em vez de "corrigir" silenciosamente.
 */
export function SimpleControls<E extends object>({ el }: { el: E }) {
  const eyebrow = (el as { eyebrow?: unknown }).eyebrow
  const toggleElementVisibility = useEditorStore((s) => s.toggleElementVisibility)
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const handleBgImg = useImageSlot('bgImg')

  return (
    <>
      <ControlSection title="Elementos">
        <ControlToggle
          label="Mostrar Eyebrow/Tag"
          checked={eyebrow !== false}
          onCheckedChange={() => toggleElementVisibility('eyebrow')}
        />
      </ControlSection>
      <ControlSection title="Imagem de Fundo">
        <ControlRow label="Imagem (Opcional)">
          <ImageUploadField onFileSelected={handleBgImg} />
        </ControlRow>
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}
