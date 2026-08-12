'use client'
import { useMemo, useState, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EmptyState, KpiCard, KpiRow, PageHeader, ScoreBadge, StatusBadge, ThreePaneLayout } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import { helpRegistry } from '@/lib/help-registry'
type Item={id:string;thesis:string;angle:string|null;hook:string|null;evidence:Record<string,unknown>;opportunity_score:number;status:string;created_at:string}

const opportunitySchema = z.object({
  thesis: z.string().min(5, 'A tese deve ter pelo menos 5 caracteres'),
  angle: z.string().optional(),
  hook: z.string().optional(),
})
type OpportunityFormData = z.infer<typeof opportunitySchema>

export function ContentOpportunityClient({initialItems}:{initialItems:Item[]}){
  const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams();
  const search=searchParams.get('search')||'';
  const selectedId = searchParams.get('selectedId') || (initialItems[0]?.id ?? '');

  const[items,setItems]=useState(initialItems),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const[wizardStep,setWizardStep]=useState(1);
  const visible=useMemo(()=>items.filter(item=>!search||`${item.thesis} ${item.angle??''} ${item.hook??''}`.toLowerCase().includes(search.toLowerCase())),[items,search]);
  const selected=items.find(item=>item.id===selectedId)??visible[0];
  
  function setSearch(value:string){
    const params=new URLSearchParams(searchParams.toString());
    if(value)params.set('search',value);else params.delete('search');
    router.replace(`${pathname}${params.size?`?${params}`:''}`,{scroll:false});
  }

  const { register, handleSubmit, formState: { errors }, trigger, reset } = useForm<OpportunityFormData>({
    resolver: zodResolver(opportunitySchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (editing && selected) {
      reset({ thesis: selected.thesis, angle: selected.angle ?? '', hook: selected.hook ?? '' });
    }
  }, [editing, selected, reset]);

  async function onSubmitUpdate(data: OpportunityFormData){
    if(!selected)return;
    setBusy(true);setMessage('');
    try{
      const response=await fetch(appPath(`/api/content-opportunities/${selected.id}`),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decision:'update',thesis:data.thesis,angle:data.angle,hook:data.hook})});
      const body=await response.json() as {item?:Item;contentItemId?:string;error?:string};
      if(!response.ok||!body.item)throw new Error(body.error??'Não foi possível atualizar');
      setItems(current=>current.map(item=>item.id===selected.id?body.item!:item));
      setEditing(false);setWizardStep(1);setMessage('Oportunidade atualizada.');
    }catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy(false)}
  }

  async function decideStatus(decision:'approve'|'reject'){
    if(!selected)return;setBusy(true);setMessage('');
    try{
      const response=await fetch(appPath(`/api/content-opportunities/${selected.id}`),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decision})});
      const body=await response.json() as {item?:Item;contentItemId?:string;error?:string};
      if(!response.ok||!body.item)throw new Error(body.error??'Não foi possível atualizar');
      setItems(current=>current.map(item=>item.id===selected.id?body.item!:item));
      setMessage(decision==='approve'?`Aprovada${body.contentItemId?' e convertida em conteúdo':''}.`:'Oportunidade rejeitada.');
    }catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy(false)}
  }

  function creative(){if(!selected)return;window.open(appPath(`/creative-bridge?opportunity=${selected.id}`),'creative-editor','popup,width=1440,height=960')}
  
  return <main className="page"><PageHeader title="Oportunidades de conteúdo" subtitle="Sinais priorizados, evidências e passagem rastreável para produção" helpContent={helpRegistry['/content-opportunity'] ?? undefined}/><KpiRow><KpiCard label="Oportunidades" value={items.length}/><KpiCard label="Novas" value={items.filter(item=>item.status==='new').length}/><KpiCard label="Aprovadas" value={items.filter(item=>item.status==='approved').length}/><KpiCard label="Score médio" value={items.length?Math.round(items.reduce((sum,item)=>sum+Number(item.opportunity_score),0)/items.length):0}/></KpiRow><p role="status">{message}</p><div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}><ThreePaneLayout list={<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><div className="toolbar" style={{ marginBottom: 'var(--space-4)' }}><label>Buscar<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Tese, ângulo ou hook"/></label></div><div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{visible.length?visible.map(item=><button key={item.id} className="lead-row" aria-pressed={selected?.id===item.id} onClick={()=>{
  const params = new URLSearchParams(searchParams.toString());
  params.set('selectedId', item.id);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  setEditing(false);setWizardStep(1);
}} style={{ border: 'none', background: selected?.id===item.id ? 'var(--surface-overlay)' : 'transparent', textAlign: 'left', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}><header style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}><ScoreBadge score={Math.round(Number(item.opportunity_score))}/><StatusBadge status={item.status}/></header><strong>{item.thesis}</strong><small>{item.hook||item.angle||'Sem hook definido'}</small></button>):<EmptyState message="Nenhuma oportunidade."/>}</div></div>} detail={<div style={{ padding: 'var(--space-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', height: '100%', overflowY: 'auto' }}>{selected?<>{editing?<form className="stack-form" onSubmit={handleSubmit(onSubmitUpdate)}>
    <h2>Editar Oportunidade - Passo {wizardStep} de 3</h2>
    {wizardStep === 1 && (
      <>
        <label>Tese<textarea {...register('thesis')} rows={4} /></label>
        {errors.thesis && <span className="error-message">{errors.thesis.message}</span>}
      </>
    )}
    {wizardStep === 2 && (
      <>
        <label>Ângulo<textarea {...register('angle')} rows={4} /></label>
        {errors.angle && <span className="error-message">{errors.angle.message}</span>}
      </>
    )}
    {wizardStep === 3 && (
      <>
        <label>Hook<textarea {...register('hook')} rows={4} /></label>
        {errors.hook && <span className="error-message">{errors.hook.message}</span>}
      </>
    )}
    <div className="action-row">
      {wizardStep > 1 && <button type="button" onClick={()=>setWizardStep(s=>s-1)}>Voltar</button>}
      {wizardStep < 3 && <button type="button" onClick={async ()=>{ const valid = await trigger(wizardStep === 1 ? 'thesis' : 'angle'); if(valid) setWizardStep(s=>s+1); }}>Avançar</button>}
      {wizardStep === 3 && <button type="submit" disabled={busy}>Salvar</button>}
      <button type="button" onClick={()=>{setEditing(false);setWizardStep(1);}}>Cancelar</button>
    </div>
  </form>:<><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><StatusBadge status={selected.status}/><ScoreBadge score={Math.round(Number(selected.opportunity_score))}/></header><h2>{selected.thesis}</h2><h3>Hook</h3><p>{selected.hook||'Não definido'}</p><h3>Ângulo</h3><p>{selected.angle||'Não definido'}</p><details style={{ marginTop: 'var(--space-4)' }}><summary>Evidências</summary><dl>{Object.entries(selected.evidence??{}).map(([key,value])=><div key={key}><dt>{key.replace(/_/g,' ')}</dt><dd>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl></details><div className="action-row" style={{ marginTop: 'var(--space-6)' }}><button disabled={busy} onClick={()=>void decideStatus('approve')}>Aprovar e criar conteúdo</button><button disabled={busy} onClick={()=>{setEditing(true);setWizardStep(1);}}>Editar</button><button disabled={busy} onClick={()=>void decideStatus('reject')}>Rejeitar</button><button onClick={creative}>Abrir no editor visual</button></div></>}</>:<EmptyState message="Selecione uma oportunidade."/>}</div>} context={selected ? <div style={{ padding: 'var(--space-4)' }}><h2>Contexto</h2><p>Criado em: {new Date(selected.created_at).toLocaleDateString('pt-BR')}</p><p>Score de oportunidade: {selected.opportunity_score}</p><StatusBadge status={selected.status}/></div> : null}/></div></main>}
