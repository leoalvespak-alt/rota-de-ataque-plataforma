'use client'

import { EmptyState, IntegrationState, KpiCard, KpiRow, PageHeader, StatusBadge, SavedViewTabs } from '@plataforma/ui-bridge'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { appPath } from '@/lib/base-path'
import type { IntegrationCapability } from '@/lib/integration-capabilities'
import { toast } from '@plataforma/ui-bridge'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

type Signal = { id: string; label: string; kind: string; velocity_7d: string | null; velocity_30d: string | null; volume_current: number | null; status: string; last_seen_at: string; evidence_refs: unknown[] }
type Watch = { id: string; kind: string; value: string; active: boolean; last_run_at: string | null; next_run_at: string | null }

const watchSchema = z.object({
  kind: z.enum(['subreddit', 'search_query', 'user']),
  value: z.string().min(2, 'Obrigatório. Mínimo 2 caracteres')
})
type WatchFormData = z.infer<typeof watchSchema>

export function MarketRadarClient({ initialSignals, initialWatches, redditStatus }: { initialSignals: Signal[]; initialWatches: Watch[]; redditStatus: IntegrationCapability | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'Sinais'

  const [watches, setWatches] = useState(initialWatches)
  const [busy, setBusy] = useState(false)
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)

  const ready = redditStatus?.status === 'ready'
  const now = Date.now()
  const activeWatches = watches.filter((item) => item.active)
  const overdue = activeWatches.filter((item) => !item.next_run_at || new Date(item.next_run_at).getTime() < now)
  const awaitingFirstRun = activeWatches.filter((item) => !item.last_run_at)
  const health = !ready ? { label: 'Não configurado', detail: 'Configure a integração Reddit antes de iniciar coletas.', tone: 'var(--status-error)' } : !activeWatches.length ? { label: 'Sem watches ativos', detail: 'Cadastre um watch para iniciar a primeira coleta.', tone: 'var(--status-warn)' } : overdue.length ? { label: 'Atrasado', detail: `${overdue.length} watch(es) ultrapassaram o próximo horário previsto. Verifique o worker e execute uma coleta.`, tone: 'var(--status-error)' } : awaitingFirstRun.length ? { label: 'Aguardando primeira coleta', detail: `${awaitingFirstRun.length} watch(es) ainda não produziram evidências.`, tone: 'var(--status-warn)' } : { label: 'Em cadência', detail: `Todos os ${activeWatches.length} watches ativos têm próxima execução futura registrada.`, tone: 'var(--status-success)' }
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, watch, trigger, reset, formState: { errors } } = useForm<WatchFormData>({
    resolver: zodResolver(watchSchema),
    defaultValues: { kind: 'subreddit', value: '' }
  })

  const formValues = watch()

  function changeTab(nextTab: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab !== 'Sinais') params.set('tab', nextTab)
    else params.delete('tab')
    
    startTransition(() => {
      router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
    })
  }

  async function handleNextStep(event: React.MouseEvent) {
    event.preventDefault()
    const valid = await trigger()
    if (!valid) {
      toast.error('Informe um valor válido.')
      return
    }
    setWizardStep(2)
  }

  async function createWatch(data: WatchFormData) {
    setBusy(true)
    
    try {
      const response = await fetch(appPath('/api/reddit/watches'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: data.kind, value: data.value, active: true })
      })
      const body = await response.json() as { id?: string; error?: string }
      
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível criar o watch')
      
      if (body.id) {
        setWatches(items => [{
          id: body.id!,
          kind: data.kind,
          value: data.value,
          active: true,
          last_run_at: null,
          next_run_at: new Date().toISOString()
        }, ...items])
      }
      
      toast.success('Watch criado e coleta enfileirada.')
      setWizardStep(1)
      reset()
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader title="Radar de mercado" subtitle="Sinais passivos do Reddit, com velocidade, volume, evidências e frescor" />
      <KpiRow>
        <KpiCard label="Sinais" value={initialSignals.length} />
        <KpiCard label="Em alta" value={initialSignals.filter((item) => item.status === 'rising').length} />
        <KpiCard label="Watches ativos" value={watches.filter((item) => item.active).length} />
        <KpiCard label="Evidências" value={initialSignals.reduce((sum, item) => sum + (item.evidence_refs?.length ?? 0), 0)} />
      </KpiRow>
      
      {redditStatus && <IntegrationState name={redditStatus.name} status={redditStatus.status} detail={redditStatus.detail} />}
      
      <SavedViewTabs views={['Sinais', 'Watches', 'Saúde']} active={tab} onChange={changeTab} />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
        {tab === 'Sinais' && (
          initialSignals.length ? (
            <section className="signal-grid" style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {initialSignals.map((signal) => (
                <article className="card" key={signal.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusBadge status={signal.status} />
                    <small style={{ color: 'var(--text-secondary)' }}>{signal.kind.replace(/_/g, ' ')}</small>
                  </header>
                  <h2 style={{ fontSize: 'var(--font-xl)', margin: 'var(--space-2) 0' }}>{signal.label}</h2>
                  <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', margin: 0, padding: 0 }}>
                    <div style={{ background: 'var(--surface-overlay)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                      <dt style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Velocidade 7d</dt>
                      <dd style={{ margin: 0, fontWeight: 600 }}>{signal.velocity_7d ?? '—'}</dd>
                    </div>
                    <div style={{ background: 'var(--surface-overlay)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                      <dt style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Velocidade 30d</dt>
                      <dd style={{ margin: 0, fontWeight: 600 }}>{signal.velocity_30d ?? '—'}</dd>
                    </div>
                    <div style={{ background: 'var(--surface-overlay)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                      <dt style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Volume</dt>
                      <dd style={{ margin: 0, fontWeight: 600 }}>{signal.volume_current ?? '—'}</dd>
                    </div>
                  </dl>
                  <time style={{ fontSize: '12px', color: 'var(--text-tertiary)', alignSelf: 'flex-end' }}>Atualizado {new Date(signal.last_seen_at).toLocaleString('pt-BR')}</time>
                </article>
              ))}
            </section>
          ) : (
            <EmptyState message={ready ? 'Ainda não há sinais. Os watches ativos alimentarão esta tela após a coleta.' : 'Configure o Reddit para iniciar a coleta passiva.'} />
          )
        )}
        
        {tab === 'Watches' && (
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexDirection: 'column' }}>
            <section className="card watch-panel">
              <h2 style={{ marginBottom: 'var(--space-4)' }}>Novo Watch</h2>
              
              {!ready && <p style={{ color: 'var(--status-error)', marginBottom: 'var(--space-4)' }}>A criação será habilitada quando a integração Reddit estiver configurada.</p>}
              
              <form onSubmit={handleSubmit(createWatch)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '500px' }}>
                {wizardStep === 1 && (
                  <>
                    <label className="editor-field">
                      Tipo de Coleta
                      <select {...register('kind')}>
                        <option value="subreddit">Subreddit</option>
                        <option value="search_query">Consulta (Keyword)</option>
                        <option value="user">Usuário</option>
                      </select>
                      {errors.kind && <span style={{color:'var(--status-error)'}}>{errors.kind.message}</span>}
                    </label>
                    
                    <label className="editor-field">
                      Alvo
                      <input {...register('value')} placeholder="Ex.: concursospublicos" />
                      {errors.value && <span style={{color:'var(--status-error)'}}>{errors.value.message}</span>}
                    </label>
                    
                    <button type="button" className="bridge-button" data-variant="primary" disabled={!ready || !formValues.value} onClick={handleNextStep}>
                      Validar e Prosseguir &rarr;
                    </button>
                  </>
                )}
                
                {wizardStep === 2 && (
                  <div style={{ background: 'var(--surface-overlay)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <h3 style={{ marginBottom: 'var(--space-2)' }}>Preview da Coleta</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                      O alvo será persistido e a primeira coleta será enfileirada. A disponibilidade e o consumo real aparecerão na aba Saúde após a execução.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-4) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      <li><strong>Tipo:</strong> {formValues.kind}</li>
                      <li><strong>Alvo:</strong> {formValues.value}</li>
                      <li><strong>Próximo passo:</strong> criar watch e aguardar o worker confirmar a coleta</li>
                    </ul>
                    
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button type="submit" className="bridge-button" data-variant="primary" disabled={busy || !ready}>
                        {busy ? 'Criando…' : 'Confirmar e Criar Watch'}
                      </button>
                      <button type="button" className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => setWizardStep(1)}>
                        Voltar
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </section>
            
            <section>
              <h2 style={{ marginBottom: 'var(--space-4)' }}>Watches Ativos ({watches.length})</h2>
              <div className="watch-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {watches.length === 0 ? <EmptyState message="Nenhum watch configurado." /> : watches.map((watch) => (
                  <div key={watch.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <StatusBadge status={watch.active ? 'Ativo' : 'Pausado'} />
                    <strong style={{ flex: 1 }}>{watch.value}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{watch.kind.replace('_', ' ')}</span>
                    <small style={{ color: 'var(--text-tertiary)', minWidth: '150px', textAlign: 'right' }}>
                      {watch.last_run_at ? `Última coleta ${new Date(watch.last_run_at).toLocaleString('pt-BR')}` : 'Aguardando primeira coleta'}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'Saúde' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h2>Saúde da Coleta</h2>
            <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: `1px solid ${health.tone}` }}>
              <strong style={{ color: health.tone }}>{health.label}</strong>
              <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>{health.detail}</p>
              <dl className="record-list"><div><dt>Watches ativos</dt><dd>{activeWatches.length}</dd></div><div><dt>Atrasados</dt><dd>{overdue.length}</dd></div><div><dt>Sem primeira coleta</dt><dd>{awaitingFirstRun.length}</dd></div></dl>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
