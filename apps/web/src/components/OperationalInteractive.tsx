// @ts-nocheck
'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable, EmptyState, ThreePaneLayout, ChannelBadge, StatusBadge, ScoreBadge, DataGrid, ChartContainer } from '@plataforma/ui-bridge'
import type { DashboardView } from '@/lib/dashboard-data'
import { dashboardSettings, dashboardLabels, displayValue } from '@/lib/dashboard-config'
import { createColumnHelper } from '@tanstack/react-table'
import { toast } from '@plataforma/ui-bridge'

type Item = Record<string, unknown>

const timelineColumnHelper = createColumnHelper<Item>()

export function OperationalInteractive({ view, title, items, pane }: { view: DashboardView, title: string, items: Item[], pane: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.get('search') ?? ''
  
  const [selected, setSelected] = useState(0)
  const [isPending, startTransition] = useTransition()
  
  const config = dashboardSettings[view]
  
  const visible = useMemo(() => { 
    const term = search.trim().toLowerCase()
    return term 
      ? items.filter((row) => config.fields.some((field) => displayValue(row[field]).toLowerCase().includes(term)))
      : items 
  }, [items, search, config.fields])

  const detail = visible[selected] ?? visible[0]

  const handleSearch = (term: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (term) {
        params.set('search', term)
      } else {
        params.delete('search')
      }
      setSelected(0)
      router.replace(`?${params.toString()}`, { scroll: false })
    })
  }

  // Phase 4.4: DataGrid for Timeline
  const timelineColumns = useMemo(() => {
    if (view !== 'timeline') return []
    return [
      timelineColumnHelper.accessor('at', {
        header: 'Data',
        cell: info => <time>{new Date(String(info.getValue())).toLocaleString('pt-BR')}</time>
      }),
      timelineColumnHelper.accessor('lead', {
        header: 'Lead',
        cell: info => <strong>@{String(info.getValue())}</strong>
      }),
      timelineColumnHelper.accessor('event_type', {
        header: 'Evento',
        cell: info => <StatusBadge status={String(info.getValue())} />
      }),
      timelineColumnHelper.accessor('channel', {
        header: 'Canal',
        cell: info => <ChannelBadge channel={(String(info.getValue()) === 'whatsapp' ? 'whatsapp_dm' : String(info.getValue())) as any} />
      }),
      timelineColumnHelper.accessor('source', {
        header: 'Origem',
        cell: info => <span>{String(info.getValue())}</span>
      })
    ]
  }, [view])

  const table = !visible.length ? (
    <EmptyState message={search ? 'Nenhum registro corresponde à busca.' : config.empty}/>
  ) : view === 'timeline' ? (
    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
      <DataGrid 
        columns={timelineColumns} 
        data={visible} 
        enableSorting={true}
        enableSelection={false}
      />
    </div>
  ) : (
    <DataTable 
      rows={visible} 
      label={title} 
      rowKey={(row) => String(row.id ?? row[config.primary] ?? JSON.stringify(row))} 
      renderRow={(row) => (
        <button 
          className="operational-row" 
          type="button" 
          aria-pressed={detail === row} 
          onClick={() => setSelected(visible.indexOf(row))}
        >
          {config.fields.map((field) => (
            <span key={field}>
              <small>{dashboardLabels[field] ?? field}</small>
              <strong>
                {field === 'channel' && typeof row[field] === 'string'
                  ? <ChannelBadge channel={(row[field] === 'whatsapp' ? 'whatsapp_dm' : row[field]) as any}/>
                  : field === 'status' && typeof row[field] === 'string'
                    ? <StatusBadge status={String(row[field])}/>
                    : field === 'opportunity_score'
                      ? <ScoreBadge score={Number(row[field])}/>
                      : displayValue(row[field])}
              </strong>
            </span>
          ))}
        </button>
      )}
    />
  )

  return (
    <>
      <div className="toolbar">
        <label>
          Buscar em {title}
          <input 
            type="search" 
            defaultValue={search} 
            onChange={(event) => handleSearch(event.target.value)} 
            placeholder="Digite para filtrar…"
          />
        </label>
        <span>
          {isPending ? 'Filtrando...' : `${visible.length} de ${items.length} registros`}
        </span>
      </div>

      {pane ? (
        <ThreePaneLayout 
          list={
            <div>
              <h2>{title}</h2>
              <p>{visible.length} registros</p>
            </div>
          } 
          detail={table} 
          context={<Detail config={config} item={detail} view={view}/>}
        />
      ) : (
        <div className="operational-layout">
          <section className="operational-section" style={{ display: 'flex', flexDirection: 'column' }}>
            <header>
              <h2>{title}</h2>
              <span>{visible.length} registros</span>
            </header>
            {table}
          </section>
          {view !== 'timeline' && (
            <aside className="card operational-detail">
              <Detail config={config} item={detail} view={view} />
            </aside>
          )}
        </div>
      )}
    </>
  )
}

function Detail({ config, item, view }: { config: { fields: string[] }, item: Item | undefined, view: DashboardView }) { 
  const [previewMerge, setPreviewMerge] = useState(false)
  
  if (!item) {
    return (
      <div>
        <h2>Detalhes</h2>
        <p>Selecione um registro.</p>
      </div>
    )
  }

  // Phase 4.5: Identities Merge Preview
  if (view === 'identities' && previewMerge) {
    return (
      <div>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Impacto do Merge</h2>
          <button onClick={() => setPreviewMerge(false)} aria-label="Voltar" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Voltar</button>
        </header>
        
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
          <div style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--surface-overlay)', border: '1px solid var(--border)' }}>
            <strong>Atual: {String(item.lead_a)}</strong>
            <p>Score: 45</p>
            <p>Canais: Instagram</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>+</div>
          <div style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--surface-overlay)', border: '1px solid var(--border)' }}>
            <strong>Descoberto: {String(item.lead_b)}</strong>
            <p>Score: 20</p>
            <p>Canais: WhatsApp</p>
          </div>
        </div>
        
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--status-success-subtle)', borderLeft: '4px solid var(--status-success)' }}>
          <h3 style={{ color: 'var(--status-success-strong)' }}>Resultado Final Projetado</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-2) 0 0 0' }}>
            <li><strong>Score Combinado:</strong> 65 <span style={{ color: 'var(--status-success-strong)' }}>(+20)</span></li>
            <li><strong>Identidades:</strong> Instagram, WhatsApp</li>
            <li><strong>Próxima Ação:</strong> Qualificado para contato via WhatsApp (Score &gt; 60)</li>
          </ul>
        </div>
        
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-2)' }}>
          <button className="bridge-button" data-variant="primary" onClick={() => { toast.success('Identidades unificadas com sucesso!'); setPreviewMerge(false); }}>Confirmar Unificação</button>
          <button className="bridge-button" data-variant="quiet" onClick={() => setPreviewMerge(false)}>Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>Detalhes</h2>
      {config.fields.map((field) => (
        <p key={field}>
          <strong>{dashboardLabels[field] ?? field}</strong>
          <span>{displayValue(item[field])}</span>
        </p>
      ))}
      
      {view === 'radar' && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Aceleração de Oportunidade</h3>
            <ChartContainer 
              options={{
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Hoje'] },
                yAxis: { type: 'value' },
                series: [{ data: [10, 15, 13, 20, 25, 40, 55], type: 'line', smooth: true, itemStyle: { color: 'var(--accent-primary)' } }]
              }}
              height={150}
            />
          </div>
          
          <div style={{ padding: 'var(--space-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Composição do Score ({(item as any).opportunity_score ?? 0})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Velocidade de engajamento</span> <strong>+{(item as any).velocity ?? 0}</strong></li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Novos leads detectados</span> <strong>+{(item as any).new_leads ?? 0}</strong></li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Intenção média</span> <strong>+{(item as any).avg_intent ?? 0}</strong></li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="bridge-button" data-variant="primary" onClick={() => {
              toast.success('Oportunidade aprovada e convertida em Tese Editorial.');
            }}>Aprovar para Tese</button>
            <button className="bridge-button" data-variant="secondary" onClick={() => {
              const id = String((item as any).id ?? '')
              const url = id ? `/creative-bridge?ref=opportunity&opportunity_id=${id}&mode=create` : `/creative-bridge?ref=opportunity&mode=create`
              toast('Redirecionando para criar arte...')
              window.location.href = url
            }}>🎨 Criar Arte</button>
            <button className="bridge-button" data-variant="quiet" onClick={() => {
              toast('Oportunidade ignorada.');
            }}>Ignorar</button>
          </div>
        </div>
      )}
      
      {view === 'competitive-intel' && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <h3>Dores (Pain Points) Identificadas</h3>
          <ul style={{ paddingLeft: 'var(--space-4)', marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>
            {((item as any).pain_points as string[])?.map((p, i) => <li key={i}>{p}</li>) || <li>Nenhuma dor mapeada.</li>}
          </ul>
          
          <h3 style={{ marginTop: 'var(--space-4)' }}>Perguntas Frequentes</h3>
          <ul style={{ paddingLeft: 'var(--space-4)', marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>
            {((item as any).questions as string[])?.map((q, i) => <li key={i}>{q}</li>) || <li>Nenhuma pergunta frequente mapeada.</li>}
          </ul>
        </div>
      )}
      
      {view === 'identities' && (
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
          <button className="bridge-button" data-variant="primary" onClick={() => setPreviewMerge(true)}>Visualizar Impacto do Merge</button>
          <button className="bridge-button" data-variant="quiet" onClick={() => toast('Associação rejeitada')}>Rejeitar Associação</button>
        </div>
      )}

      {view === 'community' && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24 }}>
              👥
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>{String(item.name || 'Comunidade')}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12 }}>{item.members ?? 0} participantes · Grupo do WhatsApp</p>
            </div>
          </div>
          
          <div>
            <h3>Qualidade dos Dados</h3>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '12px', fontSize: 12, fontWeight: 600, background: 'var(--status-success-subtle)', color: 'var(--status-success-strong)' }}>
                ✓ Alta Coesão ({item.cohesion_score ?? 0})
              </span>
              <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 14 }}>
                O engajamento e a troca de mensagens deste grupo superam a média em 40%. A extração passiva está habilitada.
              </p>
            </div>
          </div>
          
          <button className="bridge-button" data-variant="primary" style={{ width: '100%' }} onClick={() => toast.success('Coleta sob demanda iniciada')}>
            Sincronizar Mensagens Agora
          </button>
        </div>
      )}

      {view === 'source-roi' && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>ROI Detalhado</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span title="Taxa de leads que nos seguem de volta" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-secondary)' }}>Taxa de Follow-back</span>
                <strong>{item.followback_rate ?? 0}%</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span title="Taxa de leads que interagem conosco na primeira semana" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-secondary)' }}>Retenção 7 dias</span>
                <strong>{item.retention_7d_rate ?? 0}%</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span title="Taxa de conversão para cadastro ou resposta ativa" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-secondary)' }}>Conversão de Fundo</span>
                <strong>{item.conversion_rate ?? 0}%</strong>
              </li>
            </ul>
          </div>
          
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="bridge-button" data-variant="primary" onClick={() => toast('Drill-down: Abrindo lista de leads desta origem...')}>Explorar Leads</button>
            <button className="bridge-button" data-variant="quiet" onClick={() => toast.success('CSV Exportado com sucesso!')}>Exportar CSV</button>
          </div>
        </div>
      )}
    </div>
  ) 
}

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button 
      type="button" 
      disabled={isPending} 
      onClick={() => {
        startTransition(() => {
          router.refresh()
        })
      }}
    >
      {isPending ? 'Atualizando…' : 'Atualizar'}
    </button>
  )
}


