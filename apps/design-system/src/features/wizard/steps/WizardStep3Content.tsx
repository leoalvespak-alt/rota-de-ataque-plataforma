import { useState, useEffect } from 'react'
import { useWizardStore } from '@/stores/useWizardStore'
import { cn } from '@/lib/utils'
import { FileText, Pencil, Sparkles, Minus, Plus, Upload } from 'lucide-react'
import { MarkdownImportPanel } from './MarkdownImportPanel'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

interface ThesisOption {
  id: string
  title: string
  angle: string | null
}

export function WizardStep3Content() {
  const thesisId = useWizardStore((s) => s.thesisId)
  const freeText = useWizardStore((s) => s.freeText)
  const cardCount = useWizardStore((s) => s.cardCount)
  const generateCoverWithAI = useWizardStore((s) => s.generateCoverWithAI)
  const creativeType = useWizardStore((s) => s.creativeType)
  const setThesisId = useWizardStore((s) => s.setThesisId)
  const setFreeText = useWizardStore((s) => s.setFreeText)
  const setCardCount = useWizardStore((s) => s.setCardCount)
  const setGenerateCoverWithAI = useWizardStore((s) => s.setGenerateCoverWithAI)
  const contentSource = useWizardStore((s) => s.contentSource)
  const setContentSource = useWizardStore((s) => s.setContentSource)

  const [contentMode, setContentMode] = useState<'thesis' | 'free' | 'markdown'>(
    contentSource === 'markdown' ? 'markdown' : thesisId ? 'thesis' : 'free',
  )
  const [theses, setTheses] = useState<ThesisOption[]>([])
  const [loadingTheses, setLoadingTheses] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingTheses(true)
    fetch(`${API_BASE}/api/theses`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const items = Array.isArray(data) ? data : data.theses ?? []
        setTheses(items.map((t: { id: string; title: string; angle?: string }) => ({
          id: t.id,
          title: t.title,
          angle: t.angle ?? null,
        })))
      })
      .catch(() => setTheses([]))
      .finally(() => setLoadingTheses(false))
  }, [])

  const showCardCount = creativeType === 'carousel'

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h2 className="mb-2 text-xl font-bold text-ui-text font-heading">Conteúdo e Parametrização</h2>
      <p className="mb-8 text-sm text-ui-muted">
        Defina o conteúdo textual e as opções de geração.
      </p>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-ui-text">Fonte do Conteúdo</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => { setContentMode('thesis'); setContentSource('thesis'); setFreeText('') }}
            className={cn(
              'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
              contentMode === 'thesis'
                ? 'border-brand-red bg-brand-red/5'
                : 'border-ui-border bg-ui-panel hover:border-brand-red/40',
            )}
          >
            <FileText className={cn('size-5', contentMode === 'thesis' ? 'text-brand-red' : 'text-ui-muted')} />
            <div>
              <div className="text-sm font-medium text-ui-text">Usar Tese</div>
              <div className="text-xs text-ui-muted">Selecione da base de teses</div>
            </div>
          </button>
          <button
            onClick={() => { setContentMode('free'); setContentSource('free'); setThesisId(null) }}
            className={cn(
              'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
              contentMode === 'free'
                ? 'border-brand-red bg-brand-red/5'
                : 'border-ui-border bg-ui-panel hover:border-brand-red/40',
            )}
          >
            <Pencil className={cn('size-5', contentMode === 'free' ? 'text-brand-red' : 'text-ui-muted')} />
            <div>
              <div className="text-sm font-medium text-ui-text">Texto Livre</div>
              <div className="text-xs text-ui-muted">Escreva ou cole o conteúdo</div>
            </div>
          </button>
          <button
            onClick={() => { setContentMode('markdown'); setContentSource('markdown'); setThesisId(null); setFreeText('') }}
            className={cn(
              'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
              contentMode === 'markdown'
                ? 'border-brand-red bg-brand-red/5'
                : 'border-ui-border bg-ui-panel hover:border-brand-red/40',
            )}
          >
            <Upload className={cn('size-5', contentMode === 'markdown' ? 'text-brand-red' : 'text-ui-muted')} />
            <div>
              <div className="text-sm font-medium text-ui-text">Importar Markdown</div>
              <div className="text-xs text-ui-muted">Baixe, preencha e reimporte</div>
            </div>
          </button>
        </div>
      </div>

      {contentMode === 'thesis' && (
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-ui-muted uppercase tracking-wider">
            Selecione a Tese
          </label>
          {loadingTheses ? (
            <p className="text-sm text-ui-muted">Carregando teses…</p>
          ) : theses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ui-border p-6 text-center text-sm text-ui-muted">
              Nenhuma tese cadastrada. Use texto livre ou cadastre teses na aba Teses.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-ui-border p-2">
              {theses.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setThesisId(t.id); setFreeText(t.title) }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    thesisId === t.id
                      ? 'bg-brand-red/10 text-brand-red'
                      : 'hover:bg-ui-panel2 text-ui-text',
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{t.title}</div>
                    {t.angle && <div className="mt-0.5 text-xs text-ui-muted">{t.angle}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {contentMode === 'free' && (
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-ui-muted uppercase tracking-wider">
            Texto do Conteúdo
          </label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={6}
            placeholder="Cole ou escreva aqui o conteúdo para a IA gerar o roteiro dos cards…"
            className="w-full rounded-xl border border-ui-border bg-ui-panel px-4 py-3 text-sm text-ui-text placeholder:text-ui-muted focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      )}

      {contentMode === 'markdown' && (
        <div className="mb-6">
          <MarkdownImportPanel />
        </div>
      )}

      {showCardCount && (
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold text-ui-muted uppercase tracking-wider">
            Quantidade de Cards
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCardCount(cardCount - 1)}
              disabled={cardCount <= 1}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel text-ui-text transition-colors hover:border-brand-red disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-lg font-bold text-ui-text">{cardCount}</span>
            <button
              onClick={() => setCardCount(cardCount + 1)}
              disabled={cardCount >= 10}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel text-ui-text transition-colors hover:border-brand-red disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
            <span className="text-xs text-ui-muted">máx. 10 cards</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-ui-border bg-ui-panel p-4">
        <label className="flex cursor-pointer items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className={cn('size-5', generateCoverWithAI ? 'text-brand-red' : 'text-ui-muted')} />
            <div>
              <div className="text-sm font-medium text-ui-text">Gerar capa com IA</div>
              <div className="text-xs text-ui-muted">Usa fal.ai para gerar uma imagem de fundo</div>
            </div>
          </div>
          <div
            onClick={() => setGenerateCoverWithAI(!generateCoverWithAI)}
            className={cn(
              'relative h-6 w-11 cursor-pointer rounded-full transition-colors',
              generateCoverWithAI ? 'bg-brand-red' : 'bg-ui-panel2',
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
                generateCoverWithAI ? 'translate-x-5.5' : 'translate-x-0.5',
              )}
            />
          </div>
        </label>
      </div>
    </div>
  )
}
