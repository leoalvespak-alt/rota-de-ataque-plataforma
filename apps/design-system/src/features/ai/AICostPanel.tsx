import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { DollarSign, Cpu, TrendingUp, RefreshCw } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type Period = '24h' | '7d' | '30d' | 'total'

interface TokenSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: string
  totalRequests: number
}

interface ModelBreakdown {
  model: string
  provider: string
  totalTokens: number
  totalCostUsd: string
  requests: number
}

const PERIOD_LABELS: Record<Period, string> = {
  '24h': '24h',
  '7d': '7 dias',
  '30d': '30 dias',
  total: 'Total',
}

function formatCost(usd: string | number): string {
  const val = typeof usd === 'string' ? parseFloat(usd) : usd
  if (val === 0) return '$0.00'
  if (val < 0.01) return `$${val.toFixed(6)}`
  return `$${val.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function AICostPanel() {
  const [period, setPeriod] = useState<Period>('7d')
  const [summary, setSummary] = useState<TokenSummary | null>(null)
  const [byModel, setByModel] = useState<ModelBreakdown[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/token-logs/summary?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary)
        setByModel(data.byModel)
      }
    } catch {
      setSummary(null)
      setByModel([])
    } finally {
      setLoading(false)
    }
  }, [period])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="rounded-xl border border-ui-border bg-ui-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="size-5 text-brand-red" />
          <h3 className="text-sm font-semibold text-ui-text">Consumo de IA</h3>
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                period === p
                  ? 'bg-brand-red text-white'
                  : 'text-ui-muted hover:bg-ui-panel2 hover:text-ui-text',
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <button onClick={fetchData} className="ml-1 rounded-md p-1 text-ui-muted hover:text-ui-text">
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div className="py-8 text-center text-sm text-ui-muted">Carregando dados…</div>
      ) : !summary ? (
        <div className="py-8 text-center text-sm text-ui-muted">Sem dados de consumo disponíveis.</div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-ui-panel2 p-3">
              <div className="flex items-center gap-1.5 text-xs text-ui-muted">
                <DollarSign className="size-3.5" />
                Custo Total
              </div>
              <div className="mt-1 text-lg font-bold text-ui-text">{formatCost(summary.totalCostUsd)}</div>
            </div>
            <div className="rounded-lg bg-ui-panel2 p-3">
              <div className="flex items-center gap-1.5 text-xs text-ui-muted">
                <Cpu className="size-3.5" />
                Tokens
              </div>
              <div className="mt-1 text-lg font-bold text-ui-text">{formatTokens(summary.totalTokens)}</div>
            </div>
            <div className="rounded-lg bg-ui-panel2 p-3">
              <div className="flex items-center gap-1.5 text-xs text-ui-muted">
                <TrendingUp className="size-3.5" />
                Requisições
              </div>
              <div className="mt-1 text-lg font-bold text-ui-text">{summary.totalRequests}</div>
            </div>
          </div>

          {byModel.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-ui-muted uppercase tracking-wider">Por Modelo</h4>
              <div className="space-y-2">
                {byModel.map((m) => (
                  <div
                    key={`${m.provider}-${m.model}`}
                    className="flex items-center justify-between rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2"
                  >
                    <div>
                      <div className="text-xs font-medium text-ui-text">{m.model}</div>
                      <div className="text-[10px] text-ui-muted">{m.provider} · {m.requests} req</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-ui-text">{formatCost(m.totalCostUsd)}</div>
                      <div className="text-[10px] text-ui-muted">{formatTokens(m.totalTokens)} tokens</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
