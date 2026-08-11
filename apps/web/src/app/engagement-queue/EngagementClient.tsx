'use client'

import { HealthDial, KanbanBoard, LiveBadge, PageHeader, PriorityChip, QuotaMeter, RoleBadge } from '@plataforma/ui-bridge'
import { useEffect, useMemo, useState } from 'react'
import { appPath } from '@/lib/base-path'

interface Action { id:string; action_type:string; target_ref_id:string; status:string; priority:'P0'|'P1'|'P2'|'P3'; reason_code:string; created_at:string; role:'collector'|'actor'; username:string; trace_id?:string; last_error?:string }
interface Policy { action_type:string; daily_limit:number; enabled:boolean; role:'collector'|'actor'; health_score:string|null }
export function EngagementClient({ actions, policies }: { actions:Action[]; policies:Policy[] }){
  const [connected,setConnected]=useState(false);const[lastUpdate,setLastUpdate]=useState('aguardando')
  useEffect(()=>{const source=new EventSource(appPath('/api/engagement/stream'));source.onopen=()=>setConnected(true);source.addEventListener('heartbeat',(event)=>{setConnected(true);setLastUpdate(new Date(JSON.parse((event as MessageEvent).data).at).toLocaleTimeString('pt-BR'))});source.onerror=()=>setConnected(false);return()=>source.close()},[])
  const columns=useMemo(()=>['pending','awaiting_approval','running','done','failed','blocked'].map((status)=>({title:status.replace('_',' '),items:actions.filter((item)=>item.status===status).map((item)=><article className="card action-card" key={item.id}><header><strong>{item.action_type}</strong><PriorityChip priority={item.priority??'P3'}/></header><p>{item.target_ref_id}</p><small>{item.reason_code}</small><RoleBadge role={item.role}/><details><summary>Detalhes</summary><code>{item.trace_id??item.id}</code>{item.last_error&&<p>{item.last_error}</p>}<a href="/docs/runbooks/engagement">Runbook</a></details></article>)})),[actions])
  return <div className="page"><PageHeader title="Engagement Queue" subtitle="Fila operacional; nenhuma ação executa sem política e aprovação" actions={<LiveBadge connected={connected} lastUpdate={lastUpdate}/>}/><KanbanBoard columns={columns}/><aside className="quota-panel card"><h2>Limites e contas</h2>{policies.map((policy)=><div key={`${policy.role}:${policy.action_type}`}><RoleBadge role={policy.role}/><strong>{policy.action_type}</strong><QuotaMeter used={0} limit={policy.daily_limit||1}/><HealthDial value={Math.round(Number(policy.health_score??100))} state={policy.enabled?'Ativa':'Desativada'}/></div>)}</aside></div>
}
