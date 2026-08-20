// @ts-nocheck
'use client'
import { DataGrid, EmptyState, IntegrationState, KpiCard, KpiRow, PageHeader, PriorityChip, StatusBadge } from '@plataforma/ui-bridge'
import { createColumnHelper } from '@tanstack/react-table'
import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { appPath } from '@/lib/base-path'
import type { IntegrationCapability } from '@/lib/integration-capabilities'
interface Trigger{id:string;name:string;match_expr:string;severity:string;channels:string[];dedup_key_template?:string;escalation_policy?:Record<string,unknown>;throttle_seconds?:number;active:boolean;hit_count:number;last_hit_at:string|null}
interface Alert{id:string;kind:string;severity:'info'|'warn'|'error'|'critical';created_at:string;resolved_at:string|null;payload:Record<string,unknown>}
interface Delivery{id:string;channel:string;status:string;attempts:number;sent_at:string|null;last_error:string|null}
const columnHelper = createColumnHelper<Delivery>()
const columns = [
  columnHelper.accessor('channel', { header: 'Canal', cell: info => <strong>{info.getValue()}</strong> }),
  columnHelper.accessor('status', { header: 'Status', cell: info => <StatusBadge status={info.getValue()} /> }),
  columnHelper.accessor('attempts', { header: 'Tentativas', cell: info => <span>{info.getValue()} tentativas</span> }),
  columnHelper.accessor('sent_at', { header: 'Data do Envio', cell: info => <time>{info.getValue() ? new Date(info.getValue()!).toLocaleString('pt-BR') : 'Não enviada'}</time> }),
  columnHelper.accessor('last_error', { header: 'Erro', cell: info => <span>{info.getValue() ?? ''}</span> })
]

export function NotificationsClient({triggers:initialTriggers,alerts,deliveries,capabilities=[]}:{triggers:Trigger[];alerts:Alert[];deliveries:Delivery[];capabilities?:IntegrationCapability[]}){
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = searchParams.get('tab') || 'Triggers';
  const setTab = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`${pathname}?${params.toString()}`);
  };
  const[triggers,setTriggers]=useState(initialTriggers),[busy,setBusy]=useState(''),[message,setMessage]=useState('');const tabs=['Triggers','Canais','Incidentes','Entregas'];async function toggle(item:Trigger){setBusy(item.id);setMessage('');try{const response=await fetch(appPath('/api/admin/notifications/triggers'),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({...item,active:!item.active})});if(!response.ok)throw new Error('Não foi possível atualizar o trigger');setTriggers(items=>items.map(value=>value.id===item.id?{...value,active:!value.active}:value));setMessage('Trigger atualizado.')}catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy('')}}async function test(){setBusy('test');setMessage('');try{const response=await fetch(appPath('/api/admin/notifications/test'),{method:'POST'});const body=await response.json() as {deliveries?:unknown[];error?:string};if(!response.ok)throw new Error(body.error??'Falha no teste');setMessage(body.deliveries?.length?`Teste enviado por ${body.deliveries.length} canal(is).`:'Nenhum canal está configurado; nenhuma entrega foi simulada.')}catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy('')}}return <main className="page"><PageHeader title="Notificações e erros" subtitle="Detecção, entrega e resposta operacional"/><KpiRow><KpiCard label="Triggers ativos" value={triggers.filter(item=>item.active).length}/><KpiCard label="Incidentes abertos" value={alerts.filter(item=>!item.resolved_at).length}/><KpiCard label="Falhas de entrega" value={deliveries.filter(item=>item.status==='failed').length}/><KpiCard label="Entregas" value={deliveries.length}/></KpiRow><nav className="tabs" aria-label="Seções de notificação">{tabs.map(item=><button key={item} aria-current={tab===item?'page':undefined} onClick={()=>setTab(item)}>{item}</button>)}</nav><p role="status">{message}</p>{tab==='Triggers'&&<section className="card"><h2>Triggers ({triggers.length})</h2>{triggers.length?triggers.map(item=><article className="trigger-row" key={item.id}><div><strong>{item.name}</strong><code>{item.match_expr}</code><small>{item.hit_count} ocorrências · intervalo {item.throttle_seconds}s</small></div><PriorityChip priority={item.severity==='critical'?'P0':item.severity==='error'?'P1':'P2'}/><span>{item.channels.join(', ')||'sem canal'}</span><button disabled={busy===item.id} onClick={()=>void toggle(item)}>{item.active?'Desativar':'Ativar'}</button></article>):<EmptyState message="Nenhum trigger configurado."/>}</section>}{tab==='Canais'&&<section><div className="integration-grid">{capabilities.filter(item=>['resend','runtime'].includes(item.id)).map(item=><IntegrationState key={item.id} name={item.name} status={item.status} detail={item.detail}/>)}</div><button disabled={busy==='test'} onClick={()=>void test()}>{busy==='test'?'Enviando…':'Enviar teste aos canais configurados'}</button></section>}{tab==='Incidentes'&&(alerts.length?<section className="incident-list">{alerts.map(item=><article className="card" key={item.id}><header><PriorityChip priority={item.severity==='critical'?'P0':item.severity==='error'?'P1':'P2'}/><strong>{item.kind}</strong><StatusBadge status={item.resolved_at?'Resolvido':'Aberto'}/><time>{new Date(item.created_at).toLocaleString('pt-BR')}</time></header><dl>{Object.entries(item.payload??{}).map(([key,value])=><div key={key}><dt>{key.replace(/_/g,' ')}</dt><dd>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl></article>)}</section>:<EmptyState message="Nenhum incidente registrado."/>)}{tab==='Entregas'&&(deliveries.length?<DataGrid data={deliveries} columns={columns} label="Entregas de notificação" />:<EmptyState message="Nenhuma entrega registrada."/>)}</main>}
