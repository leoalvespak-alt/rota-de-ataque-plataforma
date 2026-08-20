'use client'
import { useState } from 'react'
import { EmptyState, IntegrationState, KpiCard, KpiRow, PageHeader, StatusBadge } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import { helpRegistry } from '@/lib/help-registry'
import dynamic from 'next/dynamic'
import { toast } from '@plataforma/ui-bridge'
import { z } from 'zod'

const FlowEditor = dynamic(() => import('./FlowEditor'), { ssr: false, loading: () => <div className="skeleton bridge-skeleton" style={{ height: 400, borderRadius: 'var(--radius-md)' }} /> })
import type { IntegrationCapability } from '@/lib/integration-capabilities'

type Step={id:string;type:string;[key:string]:unknown}
type Flow={id:string;name:string;description:string|null;active:boolean;version:number;steps:Step[];subscribers:number}

const flowValidationSchema = z.object({
  steps: z.array(z.any()).min(1, 'O fluxo deve ter pelo menos um passo.'),
  hasEmptySend: z.boolean().refine(val => val === false, 'Existem passos de envio de e-mail sem assunto ou corpo de mensagem configurado.')
})

export function EmailFlowsClient({initialFlows,campaignId,stats,capability}:{initialFlows:Flow[];campaignId:string;stats:{subscribers:number;confirmed:number;suppressed:number};capability:IntegrationCapability|null}){
 const[flows,setFlows]=useState(initialFlows),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[stepType,setStepType]=useState<'send'|'wait_seconds'|'end'>('send')
 
 async function create(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy('create');setMessage('');const form=new FormData(event.currentTarget);const step:Step=stepType==='send'?{id:'send-1',type:'send',message:{subject:String(form.get('subject')),plain:String(form.get('body')),html:`<p>${String(form.get('body'))}</p>`,kind:'transactional'}}:stepType==='wait_seconds'?{id:'wait-1',type:'wait_seconds',seconds:Number(form.get('waitHours'))*3600}:{id:'end-1',type:'end'};const steps=stepType==='end'?[step]:[step,{id:'end-1',type:'end'}];try{const response=await fetch(appPath('/api/email/flows'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({campaignId,name:form.get('name'),description:form.get('description'),entryCondition:{doubleOptIn:true},steps,active:false})});const body=await response.json() as {id?:string;error?:string};if(!response.ok||!body.id)throw new Error(body.error??'Não foi possível criar');setFlows(items=>[{id:body.id!,name:String(form.get('name')),description:String(form.get('description')),active:false,version:1,steps,subscribers:0},...items]);event.currentTarget.reset();setMessage('Fluxo criado como rascunho.')}catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy('')}}
 
 async function toggle(flow:Flow){
   if (!flow.active) {
     // Validating before activating
     const hasEmptySend = flow.steps.some(step => step.type === 'send' && (!step.message || !(step.message as any).subject || !(step.message as any).plain))
     const result = flowValidationSchema.safeParse({ steps: flow.steps, hasEmptySend })
     if (!result.success) {
       const errors = result.error.issues.map(i => i.message).join(', ')
       toast.error(`Validação falhou: ${errors}`)
       return
     }
   }
   
   setBusy(flow.id);setMessage('');try{const response=await fetch(appPath('/api/email/flows'),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:flow.id,active:!flow.active})});if(!response.ok)throw new Error('Não foi possível alterar o fluxo');setFlows(items=>items.map(item=>item.id===flow.id?{...item,active:!item.active}:item));setMessage(flow.active?'Fluxo pausado.':'Fluxo ativado.')}catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy('')}
 }
 
  return <main className="page" style={{ paddingBottom: 'var(--space-8)' }}><PageHeader title="Fluxos de e-mail" subtitle="Double opt-in, nutrição por eventos e supressões" helpContent={helpRegistry['/email-flows'] ?? undefined}/><KpiRow><KpiCard label="Fluxos ativos" value={flows.filter(item=>item.active).length}/><KpiCard label="Inscritos" value={stats.subscribers}/><KpiCard label="Confirmados" value={stats.confirmed}/><KpiCard label="Suprimidos" value={stats.suppressed}/></KpiRow>{capability&&<IntegrationState name={capability.name} status={capability.status} detail={capability.detail}/>}<section className="card" style={{ marginTop: 'var(--space-6)' }}><h2>Novo fluxo</h2><form className="flow-form" onSubmit={create}><label>Nome<input name="name" required maxLength={160}/></label><label>Descrição<input name="description" maxLength={1000}/></label><label>Primeiro passo<select value={stepType} onChange={event=>setStepType(event.target.value as typeof stepType)}><option value="send">Enviar e-mail</option><option value="wait_seconds">Aguardar</option><option value="end">Encerrar</option></select></label>{stepType==='send'&&<><label>Assunto<input name="subject" required/></label><label>Mensagem<textarea name="body" required/></label></>}{stepType==='wait_seconds'&&<label>Aguardar horas<input name="waitHours" type="number" min="1" defaultValue="24"/></label>}<button disabled={busy==='create'||!campaignId}>{busy==='create'?'Criando…':'Criar rascunho'}</button></form><p role="status">{message}</p></section>{flows.length?<div className="flow-list" style={{ marginTop: 'var(--space-6)' }}>{flows.map(flow=><section className="card" key={flow.id}><header><div><h2>{flow.name}</h2><p>{flow.description||'Sem descrição'} · versão {flow.version} · {flow.subscribers} inscritos</p></div><StatusBadge status={flow.active?'Ativo':'Rascunho'}/></header><FlowEditor nodes={flow.steps.map(step=>({id:step.id,type:step.type==='send'?'Send':step.type.startsWith('wait')?'Wait':step.type==='branch_on'?'Branch':'Exit',label:step.type.replace(/_/g,' ')}))}/><button className="bridge-button" data-variant={flow.active ? "secondary" : "primary"} disabled={busy===flow.id} onClick={()=>void toggle(flow)}>{flow.active?'Pausar':'Ativar (Validar)'}</button></section>)}</div>:<EmptyState message="Nenhum fluxo configurado. Crie o primeiro rascunho acima."/>}</main>
}
