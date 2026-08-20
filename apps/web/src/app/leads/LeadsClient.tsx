'use client'

import { ChannelBadge, DataGrid, EmptyState, FilterBar, KpiCard, KpiRow, PageHeader, PriorityChip, SavedViewTabs, ScoreBadge, TimelineFeed, IdentityStrip, ContactPolicyIndicator } from '@plataforma/ui-bridge'
import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { appPath } from '@/lib/base-path'
import { helpRegistry } from '@/lib/help-registry'
import { createColumnHelper, gridFeatures } from '@plataforma/ui-bridge'

export interface LeadRow { id:string;username_current:string;profile_url:string|null;last_seen_at:string;is_private:boolean|null;is_verified:boolean|null;final_score:string;priority:'P0'|'P1'|'P2'|'P3';intent_score:string;relationship_score:string;freshness_score:string;intents:string[];sources:string[];interactions:Array<{id:string;kind:string;text:string;at:string;direction?:string;source?:string}>;identities:Array<{channel:'instagram'|'threads'|'email'|'whatsapp'|'reddit'|'whatsapp_dm'|'whatsapp_group';handle:string;verified?:boolean}>;communities:string[];nba:{id:string;action:string;channel:string|null;rationale:string;confidence:string}|null }

const columnHelper = createColumnHelper<typeof gridFeatures, LeadRow>()

export function LeadsClient({ initialRows }: { initialRows: LeadRow[] }) {
  const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams()
  const view=searchParams.get('priority')||'Todos';
  const publicOnly=searchParams.get('publicOnly')==='true';
  const search=searchParams.get('search')||'';
  
  const [selectedIds,setSelectedIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const rows=useMemo(()=>initialRows.filter((row)=>(!publicOnly||!row.is_private)&&(view==='Todos'||row.priority===view)&&(!search||`${row.username_current} ${row.intents.join(' ')} ${row.sources.join(' ')}`.toLowerCase().includes(search.toLowerCase()))),[initialRows,publicOnly,view,search])
  const totals=useMemo(()=>({qualified:initialRows.filter((row)=>row.priority==='P0'||row.priority==='P1').length,public:initialRows.filter((row)=>!row.is_private).length,average:initialRows.length?Math.round(initialRows.reduce((sum,row)=>sum+Number(row.final_score),0)/initialRows.length):0}),[initialRows])
  
  function changeView(next:string){setSelectedIds([]);const params=new URLSearchParams(searchParams.toString());if(next!=='Todos')params.set('priority',next);else params.delete('priority');router.replace(`${pathname}${params.size?`?${params}`:''}`,{scroll:false})}
  function setPublicOnly(checked:boolean){const params=new URLSearchParams(searchParams.toString());if(checked)params.set('publicOnly','true');else params.delete('publicOnly');router.replace(`${pathname}${params.size?`?${params}`:''}`,{scroll:false})}
  function setSearch(value:string){const params=new URLSearchParams(searchParams.toString());if(value)params.set('search',value);else params.delete('search');router.replace(`${pathname}${params.size?`?${params}`:''}`,{scroll:false})}
  async function prepare(){if(!selectedIds.length)return;setBusy(true);setMessage('');try{const response=await fetch(appPath('/api/leads/actions'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({leadIds:selectedIds,actionType:'follow'})});const body=await response.json() as {created?:number;error?:string};if(!response.ok)throw new Error(body.error??'Não foi possível preparar as ações');setMessage(`${body.created??0} ações enviadas para aprovação.`);setSelectedIds([])}catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy(false)}}
  
  const columns = useMemo(() => [
    columnHelper.accessor('username_current', {
      header: 'Lead',
      cell: (info: any) => <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {false ? <span title="Verificado" style={{ color: 'var(--status-success)' }}>✓</span> : null}
        <strong>@{info.getValue()}</strong>
      </div>
    }),
    columnHelper.accessor('final_score', {
      header: 'Score',
      cell: (info: any) => <ScoreBadge score={Math.round(Number(info.getValue()))} />
    }),
    columnHelper.accessor('priority', {
      header: 'Prioridade',
      cell: (info: any) => <PriorityChip priority={info.getValue()} />
    }),
    columnHelper.accessor('intents', {
      header: 'Intenção',
      cell: (info: any) => (info.getValue() as string[]).join(', ') || '—'
    }),
    columnHelper.accessor('sources', {
      header: 'Fontes',
      cell: (info: any) => (info.getValue() as string[]).join(', ') || '—'
    }),
    columnHelper.accessor('last_seen_at', {
      header: 'Última atividade',
      cell: (info: any) => <time>{new Date(info.getValue() as string).toLocaleDateString('pt-BR')}</time>
    }),
  ], [])

  const selected = selectedIds.length === 1 ? rows.find(r => r.id === selectedIds[0]) : null

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader title="Leads" subtitle="Prioridade calculada por intenção, relacionamento, origem e recência" helpContent={helpRegistry['/leads'] ?? undefined} />
      <KpiRow>
        <KpiCard label="Leads" value={initialRows.length} />
        <KpiCard label="P0 + P1" value={totals.qualified} />
        <KpiCard label="Perfis públicos" value={totals.public} />
        <KpiCard label="Score médio" value={totals.average} />
      </KpiRow>
      <SavedViewTabs views={['Todos','P0','P1','P2','P3']} active={view} onChange={changeView} />
      <div className="lead-toolbar">
        <label>Buscar<input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Username, intenção ou origem"/></label>
        <label><input type="checkbox" checked={publicOnly} onChange={(event)=>setPublicOnly(event.target.checked)}/> Somente público</label>
      </div>
      <FilterBar filters={publicOnly?['Somente público']:[]} onClear={()=>setPublicOnly(false)}/>
      
      {rows.length === 0 ? <EmptyState message="Nenhum lead corresponde aos filtros atuais."/> : (
        <div style={{ display: 'flex', flex: 1, gap: 'var(--space-4)', minHeight: 0, marginTop: 'var(--space-4)' }}>
          <section className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 2, height: '100%', overflow: 'hidden', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)' }}>
            <DataGrid
              columns={columns}
              data={rows}
              enableSelection={true}
              enableSorting={true}
              onSelectionChange={(ids) => setSelectedIds(ids)}
            />
            {selectedIds.length > 0 && (
              <div className="bulk-bar" style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
                <button type="button" disabled={busy} onClick={()=>void prepare()}>{busy?'Preparando…':`Preparar follow (${selectedIds.length})`}</button>
              </div>
            )}
            <p className="action-message" role="status" style={{ padding: '0 var(--space-4) var(--space-4)' }}>{message}</p>
          </section>
          
          <aside className="panel" style={{ flex: 1, height: '100%', overflowY: 'auto', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
            {selected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>@{selected.username_current}</h2>
                  <button onClick={()=>setSelectedIds([])} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </header>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <ContactPolicyIndicator allowed={true} reason="Horário comercial"/>
                </div>
                <KpiRow>
                  <KpiCard label="Intenção" value={Math.round(Number(selected.intent_score??0))}/>
                  <KpiCard label="Relacionamento" value={Math.round(Number(selected.relationship_score??0))}/>
                  <KpiCard label="Frescor" value={Math.round(Number(selected.freshness_score??0))}/>
                </KpiRow>
                <section>
                  <h3>Identidades</h3>
                  <div className="identity-strip-container" style={{ marginTop: 'var(--space-2)' }}>
                    {selected.identities.length ? (
                      <IdentityStrip identities={selected.identities.map(i => ({ ...i, channel: (i.channel === 'whatsapp' ? 'whatsapp_dm' : i.channel) as any }))} />
                    ) : <span>Nenhuma identidade adicional.</span>}
                  </div>
                </section>
                <section>
                  <h3>Comunidades</h3>
                  <p style={{ marginTop: 'var(--space-2)' }}>{selected.communities.join(', ')||'Nenhuma comunidade associada.'}</p>
                </section>
                {selected.nba && (
                  <section className="card">
                    <h3>Próxima melhor ação</h3>
                    <strong>{selected.nba.action}</strong>
                    <p>{selected.nba.rationale}</p>
                    <small>Confiança {Math.round(Number(selected.nba.confidence)*100)}%</small>
                  </section>
                )}
                <section>
                  <h3>Últimas interações</h3>
                  {selected.interactions.length ? <TimelineFeed events={selected.interactions}/> : <EmptyState message="Nenhuma interação registrada."/>}
                </section>
              </div>
            ) : (
              <EmptyState message={selectedIds.length > 1 ? `${selectedIds.length} leads selecionados para ação em lote.` : "Selecione um lead para ver detalhes."} />
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
