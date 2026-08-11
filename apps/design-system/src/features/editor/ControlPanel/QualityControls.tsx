import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { editorToCard } from '@/domain/adapters'
import { useFeatureFlags } from '@/domain/featureFlags'
import { validateCards } from '@/domain/validation'
import { useDecorStore } from '@/stores/useDecorStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from './ControlSection'

/** Resultado incremental do validador; não altera a arte durante a revisão. */
export function QualityControls() {
  const enabled = useFeatureFlags((state) => state.flags['quality-validator'])
  const activeTemplateId = useEditorStore((state) => state.activeTemplateId)
  const elements = useEditorStore((state) => state.elements)
  const darkMode = useEditorStore((state) => state.darkMode)
  const texture = useDecorStore((state) => state.texture)
  const watermark = useDecorStore((state) => state.watermark)
  const bgLibrarySelected = useDecorStore((state) => state.bgLibrarySelected)
  if (!enabled) return null
  const card = editorToCard({ activeTemplateId, elements, darkMode }, { texture, watermark, bgLibrarySelected }, 'preview-card')
  const result = card ? validateCards([card]) : { valid: true, issues: [] }
  return (
    <ControlSection title="Qualidade">
      <div className="space-y-2 px-4 pb-4 text-xs">
        {result.valid ? (
          <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="size-4" /> Sem erros impeditivos.</div>
        ) : (
          result.issues.map((issue) => <div key={issue.code} className="flex gap-2 text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{issue.message}</div>)
        )}
      </div>
    </ControlSection>
  )
}
