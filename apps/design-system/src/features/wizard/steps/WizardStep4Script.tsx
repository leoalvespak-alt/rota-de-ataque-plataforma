import { useState, useMemo, useEffect } from 'react'
import { useWizardStore, type ScriptCard } from '@/stores/useWizardStore'
import { getTemplateById } from '@/features/templates/registry'
import { ProfileCanvasWrapper } from '@/features/templates/ProfileCanvasWrapper'
import { cn } from '@/lib/utils'
import { Eye, RefreshCw, Sparkles, X, Loader2 } from 'lucide-react'
import { useWizardAI } from '@/features/wizard/hooks/useWizardAI'
import { getTemplateContract } from '@/domain/templateContracts'

function CardPreviewModal({ card, templateId, profileId, onClose }: { card: ScriptCard; templateId: string; profileId: string | null; onClose: () => void }) {
  if (!templateId) return null
  const tpl = getTemplateById(templateId)
  if (!tpl) return null

  const elements = {
    ...tpl.defaults as Record<string, unknown>,
    ...card.fields,
    title: card.title,
    subtitle: card.body,
    body: card.body,
    eyebrow: card.eyebrow ?? '',
  }

  const Render = tpl.Render

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="relative max-h-[80vh] overflow-auto rounded-xl bg-ui-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 rounded-lg p-1 text-ui-muted hover:text-ui-text"
        >
          <X className="size-5" />
        </button>
        <ProfileCanvasWrapper profileId={profileId}>
          <div
            className="pointer-events-none origin-top-left"
            style={{
              width: tpl.format === 'portrait' ? 1080 : 1080,
              height: tpl.format === 'portrait' ? 1920 : 1080,
              transform: 'scale(0.35)',
              transformOrigin: 'top left',
            }}
          >
            <Render elements={elements as never} dark={false} />
          </div>
        </ProfileCanvasWrapper>
      </div>
    </div>
  )
}

function ScriptCardEditor({
  card,
  index,
  onUpdate,
  onPreview,
  onRegenerate,
  generating,
}: {
  card: ScriptCard
  index: number
  onUpdate: (id: string, patch: Partial<ScriptCard>) => void
  onPreview: (card: ScriptCard, index: number) => void
  onRegenerate: (id: string) => void
  generating: boolean
}) {
  const textFields = getTemplateContract(card.templateId ?? '')?.fieldSchema.fields.filter(
    (field) => field.type === 'text',
  ) ?? []

  const updateField = (name: string, value: string) => {
    const fields = { ...card.fields, [name]: value }
    onUpdate(card.id, {
      fields,
      ...(name === 'title' ? { title: value } : {}),
      ...(['body', 'subtitle', 'text'].includes(name) ? { body: value } : {}),
      ...(name === 'eyebrow' ? { eyebrow: value } : {}),
    })
  }
  const roleLabels: Record<string, string> = {
    cover: 'Capa',
    slide: `Slide ${index + 1}`,
    cta: 'CTA Final',
  }

  return (
    <div className="rounded-xl border border-ui-border bg-ui-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ui-text">{roleLabels[card.role] ?? card.role}</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPreview(card, index)}
            title="Prévia do card"
            className="rounded-lg p-1.5 text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-ui-text"
          >
            <Eye className="size-4" />
          </button>
          <button
            onClick={() => onRegenerate(card.id)}
            title="Regenerar conteúdo deste card"
            disabled={generating}
            className="rounded-lg p-1.5 text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-brand-red disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", generating && "animate-spin")} />
          </button>
        </div>
      </div>

      {(textFields.length ? textFields : [
        { name: 'eyebrow', required: false, maxLength: 40 },
        { name: 'title', required: true, maxLength: 90 },
        { name: 'body', required: false, maxLength: 300 },
      ]).map((field) => {
        const multiline = !['eyebrow', 'title', 'cta'].includes(field.name)
        return (
          <div className="mb-3" key={field.name}>
            <label className="mb-1 block text-[11px] font-medium text-ui-muted">
              {field.name}{field.required ? ' *' : ''}
            </label>
            {multiline ? (
              <textarea
                value={card.fields[field.name] ?? ''}
                onChange={(event) => updateField(field.name, event.target.value)}
                maxLength={field.maxLength}
                rows={3}
                className="w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text focus:border-brand-red focus:outline-none"
              />
            ) : (
              <input
                type="text"
                value={card.fields[field.name] ?? ''}
                onChange={(event) => updateField(field.name, event.target.value)}
                maxLength={field.maxLength}
                className="w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text focus:border-brand-red focus:outline-none"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function WizardStep4Script() {
  const scriptCards = useWizardStore((s) => s.scriptCards)
  const updateScriptCard = useWizardStore((s) => s.updateScriptCard)
  const getTemplateForSlide = useWizardStore((s) => s.getTemplateForSlide)
  const profileId = useWizardStore((s) => s.profileId)

  const [preview, setPreview] = useState<{ card: ScriptCard; index: number } | null>(null)
  const [regenerateContext, setRegenerateContext] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatingCardId, setGeneratingCardId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const { regenerateAll, regenerateCard } = useWizardAI({
    onSuccess: () => setFeedback({ type: 'success', message: 'Copy regenerada com sucesso!' }),
    onError: (error) => setFeedback({ type: 'error', message: error.message }),
  })

  // Limpar feedback após 5 segundos
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Removido: Cards agora são inicializados na Etapa 3
  const ensureCards = useMemo(() => {
    return scriptCards.length > 0 ? scriptCards : []
  }, [scriptCards])

  const handleRegenerateAll = async () => {
    setGenerating(true)
    try {
      await regenerateAll(regenerateContext)
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerateCard = async (cardId: string) => {
    setGeneratingCardId(cardId)
    try {
      const copy = await regenerateCard(cardId, regenerateContext)
      if (copy) {
        updateScriptCard(cardId, copy)
      }
    } finally {
      setGeneratingCardId(null)
    }
  }

  return (
       <div className="mx-auto max-w-2xl px-6 py-10">
         {feedback && (
           <div className={cn(
             "fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg",
             feedback.type === 'success' ? "bg-emerald-500" : "bg-red-500",
           )}>
             {feedback.message}
           </div>
         )}
         <div className="mb-6 flex items-center justify-between">
           <div>
             <h2 className="text-xl font-bold text-ui-text font-heading">Roteiro</h2>
             <p className="mt-1 text-sm text-ui-muted">
               Edite o conteúdo de cada card. Use o botão de prévia para visualizar.
             </p>
           </div>
           <button
             onClick={handleRegenerateAll}
             disabled={generating}
             className="inline-flex items-center gap-1.5 rounded-lg border border-ui-border px-3 py-2 text-xs font-medium text-ui-text transition-colors hover:border-brand-red hover:text-brand-red disabled:opacity-50"
           >
             {generating ? (
               <>
                 <Loader2 className="size-3.5 animate-spin" />
                 Regenerando...
               </>
             ) : (
               <>
                 <Sparkles className="size-3.5" />
                 Regenerar Tudo
               </>
             )}
           </button>
         </div>

      <div className="mb-6 rounded-xl border border-ui-border bg-ui-panel p-3">
        <label className="mb-1 block text-[11px] font-medium text-ui-muted">
          Contexto adicional para regeneração
        </label>
        <textarea
          value={regenerateContext}
          onChange={(e) => setRegenerateContext(e.target.value)}
          rows={2}
          placeholder="Instruções adicionais para a IA ao regenerar o conteúdo…"
          className="w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text placeholder:text-ui-muted/50 focus:border-brand-red focus:outline-none"
        />
      </div>

       <div className="space-y-4">
         {(scriptCards.length > 0 ? scriptCards : ensureCards).map((card, i) => (
           <ScriptCardEditor
             key={card.id}
             card={card}
             index={i}
             onUpdate={updateScriptCard}
             onPreview={(card, index) => setPreview({ card, index })}
             onRegenerate={handleRegenerateCard}
             generating={generatingCardId === card.id}
           />
         ))}
       </div>

      {preview && (
        <CardPreviewModal
          card={preview.card}
          templateId={getTemplateForSlide(preview.index) ?? ''}
          profileId={profileId}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
