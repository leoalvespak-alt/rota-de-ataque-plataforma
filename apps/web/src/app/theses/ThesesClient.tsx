'use client'

import { EmptyState, KpiCard, KpiRow, PageHeader, StatusBadge, ThreePaneLayout } from '@plataforma/ui-bridge'
import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { appPath } from '@/lib/base-path'
import { helpRegistry } from '@/lib/help-registry'
type Thesis={id:string;title:string;description:string;tenets:string[];forbidden_angles:string[];tone_guidelines:string|null;example_hooks:string[];version:number;active:boolean;content_count:number;impressions:number;engagements:number;conversions:number}

const thesisSchema = z.object({
  title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres'),
  tenets: z.string().optional(),
  forbiddenAngles: z.string().optional(),
  toneGuidelines: z.string().optional(),
  exampleHooks: z.string().optional(),
})
type ThesisFormData = z.infer<typeof thesisSchema>

export function ThesesClient({initialTheses}:{initialTheses:Thesis[]}){
  const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams();
  const selectedId = searchParams.get('selectedId') || (initialTheses[0]?.id ?? null);
  
  function setSelectedId(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('selectedId', id);
    else params.delete('selectedId');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const[items,setItems]=useState(initialTheses),[creating,setCreating]=useState(false),[editing,setEditing]=useState<Thesis|null>(null),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ThesisFormData>({
    resolver: zodResolver(thesisSchema),
    defaultValues: { title: '', description: '', tenets: '', forbiddenAngles: '', toneGuidelines: '', exampleHooks: '' }
  })
  
  async function onSubmit(data: ThesisFormData){
    const isEditing=Boolean(editing);setBusy(isEditing?'edit':'create');setMessage('');
    try{
      const response=await fetch(appPath('/api/theses'),{
        method:isEditing?'PATCH':'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          ...(editing?{id:editing.id}:{}),title:data.title,
          description:data.description,
          tenets:data.tenets?data.tenets.split('\n').filter(Boolean):[],
          forbiddenAngles:data.forbiddenAngles?data.forbiddenAngles.split('\n').filter(Boolean):[],
          toneGuidelines:data.toneGuidelines||null,
          exampleHooks:data.exampleHooks?data.exampleHooks.split('\n').filter(Boolean):[]
        })
      });
      const body=await response.json() as {item?:Thesis;error?:string};
      if(!response.ok)throw new Error(body.error==='active_thesis_limit'?'O limite de sete teses ativas foi atingido.':body.error??'Não foi possível salvar a tese');
      if(body.item)setItems((value)=>isEditing?value.map(current=>current.id===body.item!.id?{...current,...body.item}:current):[{...body.item!,content_count:0,impressions:0,engagements:0,conversions:0},...value]);
      setCreating(false);setEditing(null);setSelectedId(body.item!.id);setMessage(isEditing?'Nova versão da tese salva com auditoria.':'Tese criada com auditoria.');
      reset();
    }catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy('')}
  }
  
  async function toggle(item:Thesis){setBusy(item.id);setMessage('');try{const response=await fetch(appPath('/api/theses'),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:item.id,active:!item.active})});const body=await response.json() as {item?:Thesis;error?:string};if(!response.ok)throw new Error(body.error==='active_thesis_limit'?'O limite de sete teses ativas foi atingido.':body.error??'Não foi possível atualizar');if(body.item)setItems((value)=>value.map((current)=>current.id===item.id?{...current,...body.item}:current));setMessage(item.active?'Tese pausada.':'Tese ativada.')}catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy('')}}
  
  const active=items.filter((item)=>item.active).length;const selected=items.find(t=>t.id===selectedId);const formOpen=creating||Boolean(editing);
  const openEdit=(item:Thesis)=>{setCreating(false);setEditing(item);reset({title:item.title,description:item.description,tenets:item.tenets.join('\n'),forbiddenAngles:item.forbidden_angles.join('\n'),toneGuidelines:item.tone_guidelines??'',exampleHooks:item.example_hooks.join('\n')})}
  return <main className="page"><PageHeader title="Teses" subtitle="Princípios editoriais com origem, uso e desempenho rastreáveis" helpContent={helpRegistry['/theses'] ?? undefined} actions={<button disabled={active>=7} onClick={()=>{setCreating(true);setEditing(null);setSelectedId(null);reset();}}>Nova tese</button>}/><KpiRow><KpiCard label="Ativas" value={`${active}/7`}/><KpiCard label="Conteúdos" value={items.reduce((sum,item)=>sum+item.content_count,0)}/><KpiCard label="Impressões" value={items.reduce((sum,item)=>sum+item.impressions,0).toLocaleString('pt-BR')}/><KpiCard label="Conversões" value={items.reduce((sum,item)=>sum+item.conversions,0)}/></KpiRow><p className="action-message" role="status">{message}</p><div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}><ThreePaneLayout list={<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{items.length ? items.map(item=><button key={item.id} className="lead-row" aria-pressed={selected?.id===item.id} onClick={()=>{setSelectedId(item.id);setCreating(false);setEditing(null)}} style={{ border: 'none', background: selected?.id===item.id ? 'var(--surface-overlay)' : 'transparent', textAlign: 'left', padding: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span><strong>{item.title}</strong><br/><small>Versão {item.version}</small></span><StatusBadge status={item.active?'Ativa':'Pausada'}/></button>) : <EmptyState message="Nenhuma tese."/>}</div>} detail={<div style={{ padding: 'var(--space-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', height: '100%', overflowY: 'auto' }}>{formOpen?<form className="thesis-form" onSubmit={handleSubmit(onSubmit)}><h2>{editing?'Editar tese':'Nova tese'}</h2><label>Título<input {...register('title')}/></label>{errors.title && <span className="error-message">{errors.title.message}</span>}<label>Descrição<textarea {...register('description')} rows={4}/></label>{errors.description && <span className="error-message">{errors.description.message}</span>}<label>Princípios — um por linha<textarea {...register('tenets')} rows={4}/></label><label>Ângulos proibidos — um por linha<textarea {...register('forbiddenAngles')} rows={3}/></label><label>Diretrizes de tom<textarea {...register('toneGuidelines')} rows={3}/></label><label>Hooks de exemplo — um por linha<textarea {...register('exampleHooks')} rows={3}/></label><div className="action-row"><button type="submit" disabled={busy==='create'||busy==='edit'}>{busy==='create'||busy==='edit'?'Salvando…':editing?'Salvar nova versão':'Criar tese'}</button><button type="button" onClick={()=>{setCreating(false);setEditing(null)}}>Cancelar</button></div></form>:selected?<article className="thesis-card"><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}><div><h2>{selected.title}</h2><small>Versão {selected.version}</small></div><StatusBadge status={selected.active?'Ativa':'Pausada'}/></header><p>{selected.description}</p><div style={{ marginTop: 'var(--space-4)' }}><h3>Princípios</h3><ul style={{ listStyle: 'disc', paddingLeft: 'var(--space-4)' }}>{selected.tenets.map((tenet)=><li key={tenet}>{tenet}</li>)}</ul></div>{selected.forbidden_angles?.length > 0 && <div style={{ marginTop: 'var(--space-4)' }}><h3>Ângulos proibidos</h3><ul style={{ listStyle: 'disc', paddingLeft: 'var(--space-4)' }}>{selected.forbidden_angles.map((angle)=><li key={angle}>{angle}</li>)}</ul></div>}{selected.tone_guidelines&&<div style={{ marginTop: 'var(--space-4)' }}><h3>Tom</h3><p>{selected.tone_guidelines}</p></div>}<div className="action-row" style={{ marginTop: 'var(--space-6)' }}><button onClick={()=>openEdit(selected)}>Editar</button><button disabled={busy===selected.id} onClick={()=>void toggle(selected)}>{busy===selected.id?'Salvando…':selected.active?'Pausar':'Ativar'}</button></div></article>:<EmptyState message="Selecione uma tese para visualizar os detalhes."/>}</div>} context={selected ? <div style={{ padding: 'var(--space-4)' }}><h2>Desempenho da Tese</h2><KpiRow><KpiCard label="Conteúdos" value={selected.content_count}/><KpiCard label="Impressões" value={selected.impressions}/><KpiCard label="Engagements" value={selected.engagements}/><KpiCard label="Conversões" value={selected.conversions}/></KpiRow></div> : null}/></div></main>}
