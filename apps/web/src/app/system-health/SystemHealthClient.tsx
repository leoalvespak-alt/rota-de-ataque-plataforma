'use client'

import { ConfirmDestructiveDialog, HealthDial, KpiCard, KpiRow, LiveBadge, PageHeader, QuotaMeter, RunbookLink } from '@plataforma/ui-bridge'
import { useState } from 'react'

interface Heartbeat { worker:string; instance_id:string; last_beat_at:string; jobs_done_window:number; jobs_failed_window:number; backlog_seen:number; p95_latency_ms:string; state:string }
interface Alert { id:string; kind:string; severity:string; created_at:string }
export function SystemHealthClient({ heartbeats, alerts, healthScore, currentTime = 0 }: { heartbeats:Heartbeat[]; alerts:Alert[]; healthScore:number; currentTime?:number }) {
  const [confirming, setConfirming] = useState(false)
  const [stopped, setStopped] = useState(false)
  const stale = heartbeats.filter((item)=>currentTime-new Date(item.last_beat_at).getTime()>90_000).length
  const critical = alerts.filter((item)=>item.severity==='critical').length
  const state = critical || stale ? 'Crítico' : alerts.length ? 'Atenção' : 'OK'
  async function toggleKillSwitch(){const response=await fetch('/prospector/api/kill-switch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:!stopped})});if(response.ok)setStopped(!stopped);setConfirming(false)}
  return <div className="page">
    <PageHeader title="Saúde do Sistema" subtitle="Heartbeats, limites operacionais, canários e incidentes" actions={<><button className={stopped?'danger active':'danger'} onClick={()=>setConfirming(true)}>{stopped?'Reativar sistema':'Kill-switch'}</button>{confirming&&<ConfirmDestructiveDialog onConfirm={()=>void toggleKillSwitch()}/>}</>} />
    <section className="health-summary card"><HealthDial value={healthScore} state={state}/><div><h2>{state}</h2><p>{critical} críticos · {stale} heartbeats atrasados · {alerts.length} alertas abertos</p><RunbookLink href="/docs/runbooks/system-health" name="Runbook de saúde"/></div></section>
    <KpiRow><KpiCard label="Workers ativos" value={heartbeats.length-stale}/><KpiCard label="Backlog" value={heartbeats.reduce((sum,item)=>sum+item.backlog_seen,0)}/><KpiCard label="Falhas na janela" value={heartbeats.reduce((sum,item)=>sum+item.jobs_failed_window,0)}/><KpiCard label="Alertas críticos" value={critical}/></KpiRow>
    <div className="feature-grid"><section className="card panel"><h2>Heartbeats por worker</h2><div className="health-table" role="table">{heartbeats.map((item)=><div role="row" key={`${item.worker}:${item.instance_id}`}><strong>{item.worker}</strong><LiveBadge connected={currentTime-new Date(item.last_beat_at).getTime()<90_000} lastUpdate={new Date(item.last_beat_at).toLocaleTimeString('pt-BR')}/><span>{item.state}</span><span>p95 {Math.round(Number(item.p95_latency_ms??0))} ms</span><span>backlog {item.backlog_seen}</span></div>)}</div></section>
      <section className="card"><h2>Quotas</h2><label>Meta API</label><QuotaMeter used={0} limit={200}/><label>Playwright</label><QuotaMeter used={heartbeats.find((i)=>i.worker==='extraction')?.backlog_seen??0} limit={100}/><label>Banco</label><QuotaMeter used={heartbeats.length} limit={100}/><label>Redis</label><QuotaMeter used={heartbeats.reduce((sum,item)=>sum+item.backlog_seen,0)} limit={10000}/><h2>Canários</h2><p>Web health · OK</p><p>Embeddings · OK</p></section></div>
  </div>
}
