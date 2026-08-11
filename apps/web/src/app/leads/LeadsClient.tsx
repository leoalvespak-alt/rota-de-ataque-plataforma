'use client'

import { DataTable, EmptyState, FilterBar, KpiCard, KpiRow, PageHeader, PriorityChip, RightDetailPane, SavedViewTabs, ScoreBadge, TimelineFeed } from '@plataforma/ui-bridge'
import { useEffect, useMemo, useState } from 'react'

export interface LeadRow { id: string; username_current: string; profile_url: string | null; last_seen_at: string; is_private: boolean | null; is_verified: boolean | null; final_score: string; priority: 'P0'|'P1'|'P2'|'P3'; intent_score: string; relationship_score: string; intents: string[]; sources: string[]; interactions: Array<{id:string;kind:string;text:string;at:string;direction?:string;source?:string}> }

export function LeadsClient({ initialRows }: { initialRows: LeadRow[] }) {
  const [selected, setSelected] = useState<LeadRow | null>(initialRows[0] ?? null)
  const [view, setView] = useState('Todos')
  const [publicOnly, setPublicOnly] = useState(false)
  useEffect(() => { const saved = localStorage.getItem('prospector:leads:view') ?? 'Todos'; queueMicrotask(() => setView(saved)) }, [])
  useEffect(() => { localStorage.setItem('prospector:leads:view', view) }, [view])
  const rows = useMemo(() => initialRows.filter((row) => (!publicOnly || !row.is_private) && (view === 'Todos' || row.priority === view)), [initialRows, publicOnly, view])
  return <div className="page">
    <PageHeader title="Leads" subtitle="Prioridade calculada a partir de intenção, relacionamento, fontes e recência" />
    <SavedViewTabs views={['Todos','P0','P1','P2','P3']} active={view} />
    <div className="filter-bar" aria-label="Filtros de leads">{['Todos','P0','P1','P2','P3'].map((item) => <button key={item} aria-pressed={view===item} onClick={() => setView(item)}>{item}</button>)}<label><input type="checkbox" checked={publicOnly} onChange={(event) => setPublicOnly(event.target.checked)} /> Somente público</label></div>
    <FilterBar filters={publicOnly ? ['Público'] : []} onClear={() => setPublicOnly(false)} />
    {rows.length === 0 ? <EmptyState message="Nenhum lead corresponde aos filtros atuais." /> : <div className="feature-grid">
      <section className="panel"><div className="table-head" role="row"><span>Lead</span><span>Score</span><span>Prioridade</span><span>Intenção</span><span>Fontes</span><span>Última atividade</span></div>
        <DataTable rows={rows} rowKey={(row) => row.id} renderRow={(row) => <button className="lead-row" onClick={() => setSelected(row)} aria-label={`Abrir ${row.username_current}`}><span>{row.is_verified ? '✓ ' : ''}@{row.username_current}</span><ScoreBadge score={Math.round(Number(row.final_score))}/><PriorityChip priority={row.priority}/><span>{row.intents.join(', ') || '—'}</span><span>{row.sources.join(', ') || '—'}</span><time>{new Date(row.last_seen_at).toLocaleDateString('pt-BR')}</time></button>} />
        <div className="bulk-bar"><button disabled title="Habilita após Passo 10.3.7">Aprovar → gerar follow</button></div>
      </section>
      {selected && <RightDetailPane title={`@${selected.username_current}`} onClose={() => setSelected(null)}><KpiRow><KpiCard label="Intenção" value={Math.round(Number(selected.intent_score ?? 0))}/><KpiCard label="Relacionamento" value={Math.round(Number(selected.relationship_score ?? 0))}/></KpiRow><h3>Últimas interações</h3><TimelineFeed events={selected.interactions}/><EmptyState message="Sem sugestão ainda" /></RightDetailPane>}
    </div>}
  </div>
}
