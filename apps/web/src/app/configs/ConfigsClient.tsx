'use client'
import { useState } from 'react'
import { EmptyState, KpiCard, KpiRow, PageHeader } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

type Config={campaign_id:string;campaign:string;p0_threshold:number;p1_threshold:number;p2_threshold:number;lambda_freshness:number;source_weights:Record<string,number>}
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

export function ConfigsClient({config}:{config:Config}){
 const[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[impact,setImpact]=useState<{total:number;priority_changes:number}|null>(null)
 
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
 
 return <main className="page"><PageHeader title="Configurações" subtitle={`Scoring e prioridade — ${config.campaign}`}/><KpiRow><KpiCard label="Limite P0" value={config.p0_threshold}/><KpiCard label="Limite P1" value={config.p1_threshold}/><KpiCard label="Limite P2" value={config.p2_threshold}/><KpiCard label="Decaimento" value={config.lambda_freshness}/></KpiRow><form className="config-form" onSubmit={handleSubmit(data => submit(data, false))}><section className="card"><h2>Faixas de prioridade</h2><p>Os limites precisam permanecer em ordem decrescente.</p><div className="threshold-grid"><label>P0<input {...register('p0')} type="number" min="0" max="100" step="1" /></label>{errors.p0 && <span className="error" style={{color: 'var(--status-error)'}}>{errors.p0.message}</span>}<label>P1<input {...register('p1')} type="number" min="0" max="100" step="1" /></label>{errors.p1 && <span className="error" style={{color: 'var(--status-error)'}}>{errors.p1.message}</span>}<label>P2<input {...register('p2')} type="number" min="0" max="100" step="1" /></label>{errors.p2 && <span className="error" style={{color: 'var(--status-error)'}}>{errors.p2.message}</span>}</div></section><section className="card"><h2>Peso por origem</h2><div className="weight-grid">{sources.map(source=><div key={source} style={{display:'flex', flexDirection:'column'}}><label>{source.replace(/_/g,' ')}<input {...register(source)} type="number" min="0" max="10" step="0.1" /></label>{errors[source] && <span className="error" style={{color: 'var(--status-error)'}}>{errors[source]?.message as string}</span>}</div>)}</div></section>{impact&&<section className="card impact-preview"><h2>Impacto da prévia</h2><strong>{impact.priority_changes} de {impact.total}</strong><p>leads mudariam de prioridade com os novos limites. Os pesos serão aplicados no próximo recálculo do worker.</p></section>}<div className="action-row"><button type="button" disabled={Boolean(busy)} onClick={handleSubmit(data => submit(data, true))}>{busy==='preview'?'Calculando…':'Calcular prévia'}</button><button type="submit" disabled={Boolean(busy)}>{busy==='save'?'Salvando…':'Salvar configuração'}</button></div><p role="status">{message}</p></form></main>
}
