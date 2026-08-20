// @ts-nocheck
'use client'
import { HealthDial, KpiCard, KpiRow, LiveBadge, PageHeader, PriorityChip, QuotaMeter, RoleBadge, StatusBadge, usePolling } from '@plataforma/ui-bridge'
import { useMemo, useState, useTransition } from 'react'
import { appPath } from '@/lib/base-path'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface Action{id:string;action_type:string;target_ref_id:string;status:string;priority:'P0'|'P1'|'P2'|'P3';role:'collector'|'actor';username:string;created_at:string;reason_code:string|null}
interface Policy{action_type:string;daily_limit:number;used_today?:number;enabled:boolean;role:'collector'|'actor';health_score:number|string|null}
export function EngagementClient({actions:initialActions,policies}:{actions:Action[];policies:Policy[]}){
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'kanban'
  const [isPending, startTransition] = useTransition()

  const[actions,setActions]=useState(initialActions),[connected,setConnected]=useState(true),[lastUpdate,setLastUpdate]=useState('inicial'),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  
  usePolling(async () => {
    try {
      const res = await fetch(appPath('/api/engagement/actions'))
      if (res.ok) {
        const data = await res.json()
        setActions(data)
        setConnected(true)
        setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    }
  }, 15000);
  
  const grouped=useMemo(()=>['pending','awaiting_approval','approved','running','done','failed','blocked'].map(status=>({status,items:actions.filter(item=>item.status===status)})).filter(group=>group.items.length),[actions]);
  
  async function decide(item:Action,decision:'approve'|'reject'|'retry'){setBusy(item.id);setMessage('');try{const response=await fetch(appPath(`/api/engagement/actions/${item.id}`),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decision})});const body=await response.json() as {status?:string;error?:string};if(!response.ok||!body.status)throw new Error(body.error??'Não foi possível atualizar');setActions(items=>items.map(action=>action.id===item.id?{...action,status:body.status!}:action));setMessage('Ação atualizada e auditada.')}catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy('')}}
  
  function changeMode(nextMode: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextMode !== 'kanban') params.set('mode', nextMode)
    else params.delete('mode')
    
    startTransition(() => {
      router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
    })
  }

  return <main className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <PageHeader title="Fila de engajamento" subtitle="Aprovação, execução, limites e falhas por conta" actions={<LiveBadge connected={connected} lastUpdate={lastUpdate}/>}/>
      <div style={{ marginTop: 'var(--space-6)', display: 'flex', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
        <button 
          onClick={() => changeMode('kanban')}
          style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: mode === 'kanban' ? 'var(--accent-primary)' : 'transparent', color: mode === 'kanban' ? 'white' : 'var(--text-secondary)' }}
        >
          Kanban
        </button>
        <button 
          onClick={() => changeMode('list')}
          style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: mode === 'list' ? 'var(--accent-primary)' : 'transparent', color: mode === 'list' ? 'white' : 'var(--text-secondary)' }}
        >
          Lista
        </button>
      </div>
    </div>
    <KpiRow><KpiCard label="Aguardando aprovação" value={actions.filter(item=>item.status==='awaiting_approval').length}/><KpiCard label="Em execução" value={actions.filter(item=>['approved','running','pending'].includes(item.status)).length}/><KpiCard label="Concluídas" value={actions.filter(item=>item.status==='done').length}/><KpiCard label="Falhas" value={actions.filter(item=>item.status==='failed').length}/></KpiRow><p role="status">{message}</p>
    <div className="engagement-layout" style={{ flex: 1, overflow: 'hidden' }}>
      <section className="queue-board" style={{ overflowY: 'auto' }}>
        {mode === 'kanban' ? (
          grouped.map(group=><div className="queue-column" key={group.status}><header><h2>{group.status.replace(/_/g,' ')}</h2><span>{group.items.length}</span></header>{group.items.map(item=><article className="card" key={item.id}><div className="action-heading"><PriorityChip priority={item.priority}/><StatusBadge status={item.status}/></div><strong>{item.action_type.replace(/_/g,' ')}</strong><p>@{item.username} · <RoleBadge role={item.role}/></p><small>{new Date(item.created_at).toLocaleString('pt-BR')}{item.reason_code?` · ${item.reason_code}`:''}</small><div className="action-row">{item.status==='awaiting_approval'&&<><button disabled={busy===item.id} onClick={()=>void decide(item,'approve')}>Aprovar</button><button disabled={busy===item.id} onClick={()=>void decide(item,'reject')}>Rejeitar</button></>}{['failed','blocked'].includes(item.status)&&<button disabled={busy===item.id} onClick={()=>void decide(item,'retry')}>Tentar novamente</button>}</div></article>)}</div>)
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {actions.map(item=><article className="card" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}><PriorityChip priority={item.priority}/><StatusBadge status={item.status}/><strong>{item.action_type.replace(/_/g,' ')}</strong></div>
                <p>@{item.username} · <RoleBadge role={item.role}/></p>
                <small>{new Date(item.created_at).toLocaleString('pt-BR')}{item.reason_code?` · ${item.reason_code}`:''}</small>
              </div>
              <div className="action-row">
                {item.status==='awaiting_approval'&&<><button disabled={busy===item.id} onClick={()=>void decide(item,'approve')}>Aprovar</button><button disabled={busy===item.id} onClick={()=>void decide(item,'reject')}>Rejeitar</button></>}
                {['failed','blocked'].includes(item.status)&&<button disabled={busy===item.id} onClick={()=>void decide(item,'retry')}>Tentar novamente</button>}
              </div>
            </article>)}
          </div>
        )}
      </section>
      <aside className="quota-panel card" style={{ overflowY: 'auto' }}><h2>Limites de hoje</h2>{policies.map(policy=><div key={`${policy.role}:${policy.action_type}`}><RoleBadge role={policy.role}/><strong>{policy.action_type}</strong><QuotaMeter used={policy.used_today??0} limit={policy.daily_limit||1}/><HealthDial value={Math.round(Number(policy.health_score??100))} state={policy.enabled?'Ativa':'Desativada'}/></div>)}</aside>
    </div>
  </main>
}
