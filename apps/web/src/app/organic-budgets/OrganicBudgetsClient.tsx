'use client'

import { PageHeader, KpiCard, KpiRow, EmptyState } from '@plataforma/ui-bridge'
import { toast } from '@plataforma/ui-bridge'
import { useState } from 'react'
import { appPath } from '@/lib/base-path'

interface Budget { scope: string; scope_id: string; period: string; limit_usd: number; spent_usd: number; period_started_at: string }
interface Spend { provider: string; total_usd: number; call_count: number }
interface ProviderInfo {
  id: string; name: string; envEnabled: string; envKey: string
  enabled: boolean; hasKey: boolean
  dailyBudget?: Budget; monthlyBudget?: Budget; recentSpend?: Spend
}

export function OrganicBudgetsClient({ providers }: { providers: ProviderInfo[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState<{ provider: string; period: 'daily' | 'monthly'; value: string } | null>(null)

  const saveBudget = async (providerId: string, period: 'daily' | 'monthly', limitUsd: number) => {
    setBusy(providerId)
    try {
      const response = await fetch(appPath('/api/admin/organic-budgets'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope: 'provider', scopeId: providerId, period, limitUsd }),
      })
      if (!response.ok) throw new Error('Failed to save budget')
      toast.success(`Teto ${period === 'daily' ? 'diário' : 'mensal'} atualizado`)
      setEditingBudget(null)
      window.location.reload()
    } catch {
      toast.error('Erro ao salvar teto')
    } finally { setBusy(null) }
  }

  const totalMonthlySpend = providers.reduce((sum, p) => sum + (p.recentSpend ? Number(p.recentSpend.total_usd) : 0), 0)
  const activeCount = providers.filter(p => p.enabled && p.hasKey).length

  return (
    <div className="page">
      <PageHeader title="Orçamento Orgânico" subtitle="Controle de gastos com providers de dados pagos" />
      <KpiRow>
        <KpiCard label="Providers ativos" value={activeCount} />
        <KpiCard label="Gasto últimos 30d" value={`$${totalMonthlySpend.toFixed(2)}`} />
        <KpiCard label="Chamadas últimos 30d" value={providers.reduce((s, p) => s + Number(p.recentSpend?.call_count ?? 0), 0)} />
      </KpiRow>

      <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
        {providers.map(provider => {
          const canActivate = provider.hasKey && (provider.dailyBudget || provider.monthlyBudget)
          const dailyPct = provider.dailyBudget ? (Number(provider.dailyBudget.spent_usd) / Number(provider.dailyBudget.limit_usd)) * 100 : 0
          const monthlyPct = provider.monthlyBudget ? (Number(provider.monthlyBudget.spent_usd) / Number(provider.monthlyBudget.limit_usd)) * 100 : 0

          return (
            <div key={provider.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '16px' }}>{provider.name}</strong>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: provider.enabled ? 'var(--status-success-subtle)' : 'var(--surface-overlay)', color: provider.enabled ? 'var(--status-success-strong)' : 'var(--text-disabled)' }}>
                    {provider.enabled ? 'Ativo' : 'Desligado'}
                  </span>
                  {!provider.hasKey && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--status-warning-subtle)', color: 'var(--status-warning)' }}>Sem chave API</span>
                  )}
                </div>
                {!canActivate && provider.enabled && (
                  <span style={{ fontSize: '12px', color: 'var(--status-error)' }}>Requer chave API e teto configurado</span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {(['daily', 'monthly'] as const).map(period => {
                  const budget = period === 'daily' ? provider.dailyBudget : provider.monthlyBudget
                  const pct = period === 'daily' ? dailyPct : monthlyPct
                  const isEditing = editingBudget?.provider === provider.id && editingBudget.period === period

                  return (
                    <div key={period} style={{ padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{period === 'daily' ? 'Teto diário' : 'Teto mensal'}</span>
                        <button className="bridge-button" data-variant="ghost" style={{ fontSize: '11px', padding: '2px 6px' }}
                          onClick={() => setEditingBudget({ provider: provider.id, period, value: String(budget?.limit_usd ?? 0) })}>
                          Editar
                        </button>
                      </div>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px' }}>$</span>
                          <input type="number" min="0" step="0.01" value={editingBudget!.value}
                            onChange={e => setEditingBudget({ ...editingBudget!, value: e.target.value })}
                            style={{ width: '80px', padding: '4px', border: '1px solid var(--border-default)', borderRadius: '4px', fontSize: '13px' }} />
                          <button className="bridge-button" data-variant="primary" style={{ fontSize: '11px', padding: '2px 8px' }}
                            disabled={busy === provider.id}
                            onClick={() => void saveBudget(provider.id, period, Number(editingBudget!.value))}>
                            Salvar
                          </button>
                          <button className="bridge-button" data-variant="ghost" style={{ fontSize: '11px', padding: '2px 8px' }}
                            onClick={() => setEditingBudget(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : budget ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                            <span>${Number(budget.spent_usd).toFixed(2)}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>${Number(budget.limit_usd).toFixed(2)}</span>
                          </div>
                          <div style={{ height: '6px', background: 'var(--surface-overlay)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct > 90 ? 'var(--status-error)' : pct > 70 ? 'var(--status-warning)' : 'var(--status-success)', borderRadius: '3px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>Não configurado</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {provider.recentSpend && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Últimos 30 dias: ${Number(provider.recentSpend.total_usd).toFixed(2)} em {provider.recentSpend.call_count} chamadas
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
