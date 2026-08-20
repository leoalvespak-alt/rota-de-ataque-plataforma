'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable, EmptyState, ThreePaneLayout, ChannelBadge, StatusBadge, ScoreBadge, DataGrid } from '@plataforma/ui-bridge'
import type { DashboardView } from '@/lib/dashboard-data'
import { dashboardSettings, dashboardLabels, displayValue } from '@/lib/dashboard-config'
import { createColumnHelper, gridFeatures } from '@plataforma/ui-bridge'

type Item = Record<string, unknown>

const timelineColumnHelper = createColumnHelper<typeof gridFeatures, Item>()

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
        cell: (info: any) => <time>{new Date(String(info.getValue())).toLocaleString('pt-BR')}</time>
      }),
      timelineColumnHelper.accessor('lead', {
        header: 'Lead',
        cell: (info: any) => <strong>@{String(info.getValue())}</strong>
      }),
      timelineColumnHelper.accessor('event_type', {
        header: 'Evento',
        cell: (info: any) => <StatusBadge status={String(info.getValue())} />
      }),
      timelineColumnHelper.accessor('channel', {
        header: 'Canal',
        cell: (info: any) => <ChannelBadge channel={(String(info.getValue()) === 'whatsapp' ? 'whatsapp_dm' : String(info.getValue())) as any} />
      }),
      timelineColumnHelper.accessor('source', {
        header: 'Origem',
        cell: (info: any) => <span>{String(info.getValue())}</span>
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
  
  if (!item) {
    return (
      <div>
        <h2>Detalhes</h2>
        <p>Selecione um registro.</p>
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
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Histórico de aceleração</h3>
            <p>O histórico desta leitura ainda não foi calculado por uma fonte persistida. Use o Radar para consultar a evidência atual.</p>
          </div>
          
          <div style={{ padding: 'var(--space-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Composição do Score ({(item as any).opportunity_score ?? 0})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Velocidade de engajamento</span> <strong>+{(item as any).velocity ?? 0}</strong></li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Novos leads detectados</span> <strong>+{(item as any).new_leads ?? 0}</strong></li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Intenção média</span> <strong>+{(item as any).avg_intent ?? 0}</strong></li>
            </ul>
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
      
      {view === 'community' && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24 }}>
              👥
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>{String(item.name || 'Comunidade')}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12 }}>{String(item.members ?? 0)} participantes · Grupo do WhatsApp</p>
            </div>
          </div>
          
          <p>Coesão registrada: {item.cohesion_score == null ? 'sem cálculo disponível' : String(item.cohesion_score)}.</p>
        </div>
      )}

      {view === 'source-roi' && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>ROI Detalhado</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span title="Taxa de leads que nos seguem de volta" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-secondary)' }}>Taxa de Follow-back</span>
                <strong>{String(item.followback_rate ?? 0)}%</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span title="Taxa de leads que interagem conosco na primeira semana" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-secondary)' }}>Retenção 7 dias</span>
                <strong>{String(item.retention_7d_rate ?? 0)}%</strong>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span title="Taxa de conversão para cadastro ou resposta ativa" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-secondary)' }}>Conversão de Fundo</span>
                <strong>{String(item.conversion_rate ?? 0)}%</strong>
              </li>
            </ul>
          </div>
          
          <p>Exportação será disponibilizada somente quando houver endpoint auditável para o recorte selecionado.</p>
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
      className="bridge-button"
      data-variant="secondary"
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


