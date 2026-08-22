'use client'

import { useState, useEffect, useCallback } from 'react'
import { StatusBadge, Button, KpiRow, KpiCard, PageHeader } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import { AlertCircle, Play, Power, ShieldAlert, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'

// Tipos baseados na API recém-criada
interface EngineState {
  key: string
  slug: string
  name_pt: string
  description_pt: string
  alwaysOn: boolean
  dependsOn: string[]
  state: 'off' | 'starting' | 'on' | 'attention' | 'error'
  enabledWorkers: number
  totalWorkers: number
  queue: { waiting: number; active: number; failed: number }
  divergences: Array<{ worker: string; label: string; kind: string }>
  prerequisites: Array<{ key: string; satisfied: boolean; label_pt?: string; href?: string }>
}

export function MotoresTab() {
  const [engines, setEngines] = useState<EngineState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cascadePrompt, setCascadePrompt] = useState<{
    engineKey: string
    action: 'enable' | 'disable'
    dependencies?: string[]
    affected?: string[]
    message: string
  } | null>(null)

  const fetchEngines = useCallback(async () => {
    try {
      const res = await fetch(appPath('/api/admin/automations/engines'))
      if (!res.ok) throw new Error('Falha ao carregar motores')
      const data = await res.json()
      setEngines(data.engines)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEngines()
    const interval = setInterval(fetchEngines, 15000)
    return () => clearInterval(interval)
  }, [fetchEngines])

  const toggleEngine = async (engineKey: string, action: 'enable' | 'disable', cascade = false) => {
    setActionLoading(`${engineKey}:${action}`)
    setCascadePrompt(null)
    try {
      const res = await fetch(appPath('/api/admin/automations/engines'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineKey, action, cascade })
      })
      const data = await res.json()
      
      if (!res.ok) {
        if (data.error === 'cascade_required') {
          setCascadePrompt({
            engineKey,
            action,
            dependencies: data.dependencies,
            affected: data.affected,
            message: data.message
          })
          return
        }
        if (data.error === 'prerequisites_not_met') {
          throw new Error('Pré-requisitos não satisfeitos')
        }
        throw new Error(data.error ?? 'Falha ao alterar estado')
      }
      
      await fetchEngines()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha na operação')
    } finally {
      setActionLoading(null)
    }
  }

  const runNow = async (engineKey: string) => {
    if (!confirm(`Deseja forçar a execução agora do motor ${engineKey}?`)) return
    setActionLoading(`${engineKey}:run_now`)
    try {
      const res = await fetch(appPath(`/api/admin/automations/engines/${engineKey}/run-now`), { method: 'POST' })
      if (!res.ok) throw new Error('Falha ao enfileirar execução')
      alert('Execução enfileirada com sucesso.')
      fetchEngines()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && engines.length === 0) return <div style={{ padding: 40 }}>Carregando motores...</div>
  if (error) return <div style={{ padding: 40, color: 'var(--status-error)' }}>{error}</div>

  const activeCount = engines.filter(e => e.state === 'on' || e.state === 'attention').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>
      
      {/* KPI Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <KpiRow>
          <KpiCard label="Motores" value={engines.length} />
          <KpiCard label="Ativos" value={activeCount} />
          <KpiCard label="Com falhas" value={engines.filter(e => e.state === 'error').length} trend={engines.filter(e => e.state === 'error').length > 0 ? 'down' : 'neutral'} />
          <KpiCard label="Fila Total" value={engines.reduce((acc, e) => acc + (e.queue?.waiting ?? 0), 0)} />
        </KpiRow>
        <Button variant="quiet" onClick={() => fetchEngines()} disabled={actionLoading !== null}>
          Atualizar
        </Button>
      </div>

      {/* Cascade Prompt */}
      {cascadePrompt && (
        <div style={{ padding: 16, background: 'var(--surface-raised)', border: '1px solid var(--status-warning)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ margin: 0, color: 'var(--status-warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} />
            Confirmação de Cascata Necessária
          </h4>
          <p style={{ margin: 0, fontSize: 14 }}>{cascadePrompt.message}</p>
          {cascadePrompt.dependencies && (
            <div style={{ fontSize: 13 }}>Motores que serão ligados: {cascadePrompt.dependencies.join(', ')}</div>
          )}
          {cascadePrompt.affected && (
            <div style={{ fontSize: 13 }}>Motores que serão desligados: {cascadePrompt.affected.join(', ')}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button variant="primary" onClick={() => toggleEngine(cascadePrompt.engineKey, cascadePrompt.action, true)}>
              Sim, confirmar cascata
            </Button>
            <Button variant="quiet" onClick={() => setCascadePrompt(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Engines Grid */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
        {engines.map(engine => {
          const isOff = engine.state === 'off'
          const unsatisfiedPrereqs = engine.prerequisites?.filter(p => !p.satisfied) || []
          const isBlocked = unsatisfiedPrereqs.length > 0
          const statusColors: Record<string, string> = {
            on: 'var(--status-success)',
            off: 'var(--text-tertiary)',
            error: 'var(--status-error)',
            attention: 'var(--status-warning)',
            starting: 'var(--status-info)'
          }

          return (
            <div key={engine.key} style={{ 
              border: `1px solid ${isOff ? 'var(--border)' : statusColors[engine.state]}40`, 
              borderRadius: 12, 
              padding: 20, 
              background: 'var(--surface-card)',
              display: 'flex', flexDirection: 'column', gap: 16
            }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>{engine.key}</span>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{engine.name_pt}</h3>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{engine.description_pt}</p>
                </div>
                <StatusBadge status={
                  engine.state === 'on' ? 'Rodando' : 
                  engine.state === 'error' ? 'Erro' : 
                  engine.state === 'attention' ? 'Atenção' : 
                  engine.state === 'starting' ? 'Iniciando' : 'Desligado'
                } />
              </div>

              {/* Badges / Meta */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ padding: '2px 8px', background: 'var(--surface-raised)', borderRadius: 4 }}>
                  {engine.enabledWorkers} / {engine.totalWorkers} workers
                </span>
                {engine.dependsOn.length > 0 && (
                  <span style={{ padding: '2px 8px', background: 'var(--surface-raised)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowRight size={12} /> Depende de: {engine.dependsOn.join(', ')}
                  </span>
                )}
                <span style={{ padding: '2px 8px', background: 'var(--surface-raised)', borderRadius: 4, display: 'flex', gap: 6, color: engine.queue.failed > 0 ? 'var(--status-error)' : 'inherit' }}>
                  Fila: {engine.queue.waiting}W • {engine.queue.active}A • {engine.queue.failed}E
                </span>
              </div>

              {/* Divergências */}
              {engine.divergences?.length > 0 && (
                <div style={{ background: 'var(--status-warning)20', color: 'var(--status-warning)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                  <strong>Atenção:</strong> {engine.divergences.length} worker(s) com divergência de estado.
                </div>
              )}

              {/* Pré-requisitos pendentes */}
              {isBlocked && isOff && (
                <div style={{ background: 'var(--status-error)10', color: 'var(--status-error)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                  <strong>Bloqueado por pré-requisitos:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {unsatisfiedPrereqs.map(p => <li key={p.key}>{p.label_pt ?? p.key}</li>)}
                  </ul>
                </div>
              )}

              <div style={{ flex: 1 }} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                {!engine.alwaysOn && (
                  <Button 
                    variant={isOff ? 'primary' : 'danger'} 
                    disabled={actionLoading !== null || (isOff && isBlocked)}
                    onClick={() => toggleEngine(engine.key, isOff ? 'enable' : 'disable')}
                    title={isOff && isBlocked ? 'Pré-requisitos pendentes' : ''}
                  >
                    <Power size={14} style={{ marginRight: 6 }} />
                    {isOff ? 'Ligar Motor' : 'Desligar Motor'}
                  </Button>
                )}
                
                <Button 
                  variant="secondary" 
                  disabled={actionLoading !== null}
                  onClick={() => runNow(engine.key)}
                >
                  <Play size={14} style={{ marginRight: 6 }} />
                  Run Now
                </Button>
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}
