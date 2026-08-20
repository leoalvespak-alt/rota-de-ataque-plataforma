'use client'
import { useState } from 'react'
import { EmptyState, KpiCard, KpiRow, PageHeader } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

type Config={campaign_id:string;campaign:string;p0_threshold:number;p1_threshold:number;p2_threshold:number;lambda_freshness:number;source_weights:Record<string,number>}
type Budget={scope:string;scope_id:string;period:string;limit_usd:number;spent_usd:number;reserved_usd:number;period_started_at:string}
type Cost={provider:string;estimated_usd:number;actual_usd:number;operations:number}
const sources=['instagram_comment','instagram_follower','instagram_dm','threads','reddit','email','whatsapp'] as const

const configSchema = z.object({
  p0: z.coerce.number().min(0).max(100),
  p1: z.coerce.number().min(0).max(100),
  p2: z.coerce.number().min(0).max(100),
  instagram_comment: z.coerce.number().min(0).max(10).default(1),
  instagram_follower: z.coerce.number().min(0).max(10).default(1),
  instagram_dm: z.coerce.number().min(0).max(10).default(1),
  threads: z.coerce.number().min(0).max(10).default(1),
  reddit: z.coerce.number().min(0).max(10).default(1),
  email: z.coerce.number().min(0).max(10).default(1),
  whatsapp: z.coerce.number().min(0).max(10).default(1),
})

type ConfigFormData = z.infer<typeof configSchema>

export function ConfigsClient({config,budgets,costs}:{config:Config;budgets:Budget[];costs:Cost[]}){
 const[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[impact,setImpact]=useState<{total:number;priority_changes:number}|null>(null)
 const[budgetLimit,setBudgetLimit]=useState('10')
 
 const { register, handleSubmit, formState: { errors } } = useForm({
   resolver: zodResolver(configSchema),
   defaultValues: {
     p0: config?.p0_threshold ?? 0,
     p1: config?.p1_threshold ?? 0,
     p2: config?.p2_threshold ?? 0,
     instagram_comment: config?.source_weights?.['instagram_comment'] ?? 1,
     instagram_follower: config?.source_weights?.['instagram_follower'] ?? 1,
     instagram_dm: config?.source_weights?.['instagram_dm'] ?? 1,
     threads: config?.source_weights?.['threads'] ?? 1,
     reddit: config?.source_weights?.['reddit'] ?? 1,
     email: config?.source_weights?.['email'] ?? 1,
     whatsapp: config?.source_weights?.['whatsapp'] ?? 1,
   }
 })

 if(!config)return <main className="page"><PageHeader title="Configurações" subtitle="Scoring e prioridade por campanha"/><EmptyState message="Selecione uma campanha com configuração de scoring."/></main>
 
 async function submit(data: ConfigFormData, preview:boolean){
   setBusy(preview?'preview':'save');
   setMessage('');
   const payload={
     campaignId:config.campaign_id,
     weights:{
       instagram_comment: data.instagram_comment,
       instagram_follower: data.instagram_follower,
       instagram_dm: data.instagram_dm,
       threads: data.threads,
       reddit: data.reddit,
       email: data.email,
       whatsapp: data.whatsapp
     },
     thresholds:{p0:data.p0,p1:data.p1,p2:data.p2},
     preview
   };
   try{
     const response=await fetch(appPath('/api/admin/configs'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
     const body=await response.json() as {impact?:{total:number;priority_changes:number};error?:string};
     if(!response.ok)throw new Error(body.error??'Não foi possível aplicar');
     if(preview&&body.impact){setImpact(body.impact);setMessage('Prévia calculada com os scores reais da campanha.')}
     else setMessage('Configuração salva e auditada.')
   }catch(error){
     setMessage(error instanceof Error?error.message:'Erro inesperado')
   }finally{
     setBusy('')
   }
 }
 
 async function saveBudget(){setBusy('budget');const response=await fetch(appPath('/api/admin/organic-budgets'),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({scope:'global',scopeId:'global',period:'daily',limitUsd:Number(budgetLimit)})});setMessage(response.ok?'Budget diário salvo; chamadas continuam bloqueadas acima do limite.':'Falha ao salvar budget.');setBusy('')}
 return <main className="page"><PageHeader title="Configurações" subtitle={`Scoring, providers e custos — ${config.campaign}`}/><KpiRow><KpiCard label="Limite P0" value={config.p0_threshold}/><KpiCard label="Custo estimado/mês" value={`US$ ${costs.reduce((sum,item)=>sum+Number(item.estimated_usd),0).toFixed(2)}`}/><KpiCard label="Custo reconciliado/mês" value={`US$ ${costs.reduce((sum,item)=>sum+Number(item.actual_usd),0).toFixed(2)}`}/><KpiCard label="Operações externas" value={costs.reduce((sum,item)=>sum+item.operations,0)}/></KpiRow><section className="card"><h2>Budget orgânico</h2><p>Reserva atômica ocorre antes de qualquer chamada paga. Valores estimados e reconciliados permanecem separados.</p><label>Limite global diário (USD)<input type="number" min="0" step="0.01" value={budgetLimit} onChange={event=>setBudgetLimit(event.target.value)}/></label><button type="button" disabled={busy==='budget'} onClick={()=>void saveBudget()}>Salvar limite</button><ul>{budgets.map(item=><li key={`${item.scope}:${item.scope_id}:${item.period}`}>{item.scope}/{item.scope_id} · {item.period}: US$ {Number(item.spent_usd).toFixed(2)} gastos + US$ {Number(item.reserved_usd).toFixed(2)} reservados de US$ {Number(item.limit_usd).toFixed(2)}</li>)}</ul></section><form className="config-form" onSubmit={handleSubmit(data => submit(data, false))}><section className="card"><h2>Faixas de prioridade</h2><p>Os limites precisam permanecer em ordem decrescente.</p><div className="threshold-grid"><label>P0<input {...register('p0')} type="number" min="0" max="100" step="1" /></label><label>P1<input {...register('p1')} type="number" min="0" max="100" step="1" /></label><label>P2<input {...register('p2')} type="number" min="0" max="100" step="1" /></label></div></section><section className="card"><h2>Peso por origem</h2><div className="weight-grid">{sources.map(source=><div key={source}><label>{source.replace(/_/g,' ')}<input {...register(source)} type="number" min="0" max="10" step="0.1" /></label>{errors[source]&&<span className="error">{errors[source]?.message as string}</span>}</div>)}</div></section>{impact&&<section className="card impact-preview"><h2>Impacto da prévia</h2><strong>{impact.priority_changes} de {impact.total}</strong></section>}<div className="action-row"><button type="button" disabled={Boolean(busy)} onClick={handleSubmit(data=>submit(data,true))}>{busy==='preview'?'Calculando…':'Calcular prévia'}</button><button type="submit" disabled={Boolean(busy)}>{busy==='save'?'Salvando…':'Salvar configuração'}</button></div><p role="status">{message}</p></form></main>
}
