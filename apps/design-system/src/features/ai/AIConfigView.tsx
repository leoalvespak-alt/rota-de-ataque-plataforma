import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useAIStore, type AIModel, type AIProvider } from '@/stores/useAIStore'
import { apiFetch } from '@/lib/api/client'
import { AICostPanel } from './AICostPanel'

export function AIConfigView() {
  const { models, providers, copyModel, imageModel, setCopyModel, setImageModel, setCatalog, testConnection } = useAIStore()
  const [loading, setLoading] = useState(true)
  const [tests, setTests] = useState<Record<string, { success: boolean; latency?: number; error?: string }>>({})
  const [testing, setTesting] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ models: AIModel[]; providers: AIProvider[] }>('/ai/catalog')
      .then((catalog) => setCatalog(catalog.models, catalog.providers))
      .finally(() => setLoading(false))
  }, [setCatalog])

  const runTest = async (model: AIModel) => {
    setTesting(model.id)
    const result = await testConnection(model.id)
    setTests((current) => ({ ...current, [model.id]: result }))
    setTesting(null)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-ui-bg text-ui-text">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-heading text-[28px] font-bold tracking-[0.04em] uppercase">Configuração de IA</h1>
        <p className="mb-8 mt-2 text-sm leading-relaxed text-ui-muted">
          Credenciais, URLs e allowlists ficam exclusivamente na API. Este navegador guarda apenas os IDs dos modelos selecionados.
        </p>

        <div className="mb-8 rounded-xl border border-ui-border bg-ui-panel p-5">
          <h2 className="mb-4 text-sm font-semibold">Catálogo do servidor</h2>
          {loading ? <Loader2 className="size-5 animate-spin text-ui-muted" /> : (
            <div className="space-y-3">
              {models.map((model) => {
                const result = tests[model.id]
                return (
                  <div key={model.id} className="flex items-center gap-3 rounded-lg bg-ui-panel2 p-3">
                    {model.configured ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertCircle className="size-4 text-amber-500" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{model.label}</div>
                      <div className="text-xs text-ui-muted">{model.provider} · {model.capabilities.join(', ')} · {model.configured ? 'configurado' : 'não configurado'}</div>
                      {result && <div className={`text-xs ${result.success ? 'text-emerald-500' : 'text-red-500'}`}>{result.success ? `Conectado em ${result.latency ?? 0} ms` : result.error}</div>}
                    </div>
                    <button
                      type="button"
                      disabled={!model.configured || testing === model.id}
                      onClick={() => void runTest(model)}
                      className="inline-flex items-center gap-1 rounded-md border border-ui-border px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      <RefreshCw className={`size-3 ${testing === model.id ? 'animate-spin' : ''}`} /> Testar
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-ui-muted">Modelo de texto
              <select value={copyModel} onChange={(event) => setCopyModel(event.target.value)} className="mt-1 w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text">
                {models.filter((model) => model.capabilities.includes('text')).map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-ui-muted">Modelo de imagem
              <select value={imageModel} onChange={(event) => setImageModel(event.target.value)} className="mt-1 w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-sm text-ui-text">
                {models.filter((model) => model.capabilities.includes('image')).map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-4 text-xs text-ui-muted">Providers disponíveis: {providers.map((provider) => provider.label).join(', ') || 'nenhum'}.</p>
        </div>
        <AICostPanel />
      </div>
    </div>
  )
}
