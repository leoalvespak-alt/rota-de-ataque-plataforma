import { useState, useMemo } from 'react'
import { useWizardStore, type ScriptCard } from '@/stores/useWizardStore'
import { getTemplateById } from '@/features/templates/registry'
import { ProfileCanvasWrapper } from '@/features/templates/ProfileCanvasWrapper'
import { cn } from '@/lib/utils'
import { Eye, RefreshCw, Sparkles, X } from 'lucide-react'

function CardPreviewModal({ card, templateId, profileId, onClose }: { card: ScriptCard; templateId: string; profileId: string | null; onClose: () => void }) {
  const tpl = getTemplateById(templateId)
  if (!tpl) return null

  const elements = {
    ...tpl.defaults as Record<string, unknown>,
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
  onClear,
  onPreview,
}: {
  card: ScriptCard
  index: number
  onUpdate: (id: string, patch: Partial<ScriptCard>) => void
  onClear: (id: string) => void
  onPreview: (card: ScriptCard) => void
}) {
  const roleLabels: Record<string, string> = {
    cover: 'Capa',
    slide: `Slide ${index}`,
    cta: 'CTA Final',
  }

  return (
    <div className="rounded-xl border border-ui-border bg-ui-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ui-text">{roleLabels[card.role] ?? card.role}</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPreview(card)}
            title="Prévia do card"
            className="rounded-lg p-1.5 text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-ui-text"
          >
            <Eye className="size-4" />
          </button>
          <button
            onClick={() => onClear(card.id)}
            title="Regenerar conteúdo deste card"
            className="rounded-lg p-1.5 text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-brand-red"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {card.eyebrow !== undefined && (
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-ui-muted">Eyebrow</label>
          <input
            type="text"
            value={card.eyebrow ?? ''}
            onChange={(e) => onUpdate(card.id, { eyebrow: e.target.value })}
            placeholder="TAG CURTA"
            className="w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text placeholder:text-ui-muted/50 focus:border-brand-red focus:outline-none"
          />
        </div>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-medium text-ui-muted">Título</label>
        <input
          type="text"
          value={card.title}
          onChange={(e) => onUpdate(card.id, { title: e.target.value })}
          placeholder="Título impactante"
          className="w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text placeholder:text-ui-muted/50 focus:border-brand-red focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-ui-muted">Corpo</label>
        <textarea
          value={card.body}
          onChange={(e) => onUpdate(card.id, { body: e.target.value })}
          rows={3}
          placeholder="Texto do corpo do card…"
          className="w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text placeholder:text-ui-muted/50 focus:border-brand-red focus:outline-none"
        />
      </div>
    </div>
  )
}

export function WizardStep4Script() {
  const scriptCards = useWizardStore((s) => s.scriptCards)
  const setScriptCards = useWizardStore((s) => s.setScriptCards)
  const updateScriptCard = useWizardStore((s) => s.updateScriptCard)
  const clearScriptCard = useWizardStore((s) => s.clearScriptCard)
  const templateId = useWizardStore((s) => s.templateId)
  const cardCount = useWizardStore((s) => s.cardCount)
  const creativeType = useWizardStore((s) => s.creativeType)
  const profileId = useWizardStore((s) => s.profileId)

  const [previewCard, setPreviewCard] = useState<ScriptCard | null>(null)
  const [regenerateContext, setRegenerateContext] = useState('')
  const [generating, setGenerating] = useState(false)

  const ensureCards = useMemo(() => {
    if (scriptCards.length > 0) return scriptCards
    const cards: ScriptCard[] = []
    const isCarousel = creativeType === 'carousel'
    const total = isCarousel ? cardCount : 1

    cards.push({ id: crypto.randomUUID(), role: 'cover', title: '', body: '', eyebrow: '' })
    for (let i = 1; i < total - 1; i++) {
      cards.push({ id: crypto.randomUUID(), role: 'slide', title: '', body: '', eyebrow: '' })
    }
    if (isCarousel && total > 1) {
      cards.push({ id: crypto.randomUUID(), role: 'cta', title: '', body: '', eyebrow: '' })
    }
    return cards
  }, [scriptCards, cardCount, creativeType])

  if (scriptCards.length === 0 && ensureCards.length > 0) {
    setTimeout(() => setScriptCards(ensureCards), 0)
  }

  const handleRegenerateAll = () => {
    setGenerating(true)
    const newCards = ensureCards.map((c) => ({ ...c, title: '', body: '', eyebrow: '' }))
    setScriptCards(newCards)
    setTimeout(() => setGenerating(false), 100)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
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
          <Sparkles className={cn('size-3.5', generating && 'animate-spin')} />
          Regenerar Tudo
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
            onClear={clearScriptCard}
            onPreview={setPreviewCard}
          />
        ))}
      </div>

      {previewCard && templateId && (
        <CardPreviewModal
          card={previewCard}
          templateId={templateId}
          profileId={profileId}
          onClose={() => setPreviewCard(null)}
        />
      )}
    </div>
  )
}
