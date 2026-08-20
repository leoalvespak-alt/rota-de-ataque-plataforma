'use client'
import { useMemo, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EmptyState, KpiCard, KpiRow, PageHeader, StatusBadge } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import { helpRegistry } from '@/lib/help-registry'

type Policy={id:string;campaign_id:string|null;campaign:string;channel:string|null;cadence_seconds:number;enabled:boolean;rules:Record<string,unknown>}
type Campaign={id:string;name:string}
type Lead={id:string;username_current:string}

const policySchema = z.object({
  scope: z.string().min(1, 'Selecione um escopo'),
  channel: z.string().optional(),
  cadenceHours: z.coerce.number().min(1, 'Mínimo de 1 hora').max(720, 'Máximo de 720 horas'),
  enabled: z.boolean(),
  humanReview: z.boolean(),
  businessHours: z.boolean()
})
type PolicyFormData = z.infer<typeof policySchema>

export function ContactPoliciesClient({initialPolicies,campaigns,selectedCampaignId,leads}:{initialPolicies:Policy[];campaigns:Campaign[];selectedCampaignId:string;leads:Lead[]}){
  const[policies,setPolicies]=useState(initialPolicies),[editing,setEditing]=useState<Policy|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[decision,setDecision]=useState('');
  const active=useMemo(()=>policies.filter(item=>item.enabled).length,[policies]);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema) as any,
    defaultValues: { scope: selectedCampaignId || 'global', channel: '', cadenceHours: 24, enabled: true, humanReview: false, businessHours: false }
  })

  useEffect(() => {
    if (editing) {
      reset({
        scope: editing.campaign_id ?? 'global',
        channel: editing.channel ?? '',
        cadenceHours: Math.round(editing.cadence_seconds / 3600),
        enabled: editing.enabled,
        humanReview: Boolean(editing.rules?.requireHumanReview),
        businessHours: Boolean(editing.rules?.businessHoursOnly)
      })
    } else {
      reset({ scope: selectedCampaignId || 'global', channel: '', cadenceHours: 24, enabled: true, humanReview: false, businessHours: false })
    }
  }, [editing, selectedCampaignId, reset])

  const w = watch();
  const getNaturalText = () => {
    const scopeTxt = w.scope === 'global' ? 'aplicada globalmente' : 'aplicada a uma campanha específica';
    const channelTxt = w.channel ? `no canal ${w.channel}` : 'em todos os canais';
    return `Esta política será ${scopeTxt} ${channelTxt}, limitando os contatos a no máximo um a cada ${w.cadenceHours} hora(s). As mensagens ${w.humanReview ? 'exigirão' : 'não exigirão'} revisão humana e ${w.businessHours ? 'só poderão ser enviadas em horário comercial' : 'poderão ser enviadas a qualquer horário'}.`;
  };

  async function save(data: PolicyFormData){
    setBusy(true);setMessage('');
    const rules={respectOptOut:true,requireHumanReview:data.humanReview,businessHoursOnly:data.businessHours};
    try{
      const response=await fetch(appPath('/api/contact-policies'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:editing?.id,campaignId:data.scope==='global'?null:data.scope,channel:data.channel||null,cadenceSeconds:data.cadenceHours*3600,enabled:data.enabled,rules})});
      const body=await response.json() as {item?:Policy;error?:string};
      if(!response.ok||!body.item)throw new Error(body.error??'Não foi possível salvar');
      setPolicies(items=>[body.item!,...items.filter(item=>item.id!==body.item!.id)]);
      setEditing(null);setMessage('Política salva e auditada.')
    }catch(error){setMessage(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy(false)}
  }
  
  async function simulate(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setDecision('');const form=new FormData(event.currentTarget);try{const response=await fetch(appPath('/api/contact-policies/evaluate'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({leadId:form.get('leadId'),campaignId:selectedCampaignId||undefined,channel:form.get('channel')})});const body=await response.json().catch(()=>({})) as {allowed?:boolean;explanation?:string;nextAllowedAt?:string;error?:string};if(!response.ok)throw new Error(body.error??'Não foi possível avaliar');setDecision(`${body.allowed?'Permitido':'Bloqueado'}: ${body.explanation??'Sem explicação disponível.'}${body.nextAllowedAt?` Próxima janela: ${new Date(body.nextAllowedAt).toLocaleString('pt-BR')}.`:''}`)}catch(error){setDecision(error instanceof Error?error.message:'Erro inesperado')}finally{setBusy(false)}}
  
  return <main className="page"><PageHeader title="Políticas de contato" subtitle="Cadência, consentimento e revisão humana por canal e campanha" helpContent={helpRegistry['/contact-policies'] ?? undefined}/><KpiRow><KpiCard label="Políticas" value={policies.length}/><KpiCard label="Ativas" value={active}/><KpiCard label="Globais" value={policies.filter(item=>!item.campaign_id).length}/><KpiCard label="Canais cobertos" value={new Set(policies.map(item=>item.channel).filter(Boolean)).size}/></KpiRow><div className="policy-layout"><section className="card"><h2>{editing?'Editar política':'Nova política'}</h2><form className="stack-form" onSubmit={handleSubmit(save as any)} key={editing?.id??'new'}>
    <label>Escopo<select {...register('scope')}><option value="global">Global</option>{campaigns.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{errors.scope && <span className="error-message">{errors.scope.message}</span>}
    <label>Canal<select {...register('channel')}><option value="">Todos</option><option value="instagram">Instagram</option><option value="threads">Threads</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></label>
    <label>Intervalo mínimo (horas)<input {...register('cadenceHours')} type="number" min="1" max="720"/></label>{errors.cadenceHours && <span className="error-message">{errors.cadenceHours.message}</span>}
    <label><input {...register('enabled')} type="checkbox"/> Política ativa</label>
    <label><input {...register('humanReview')} type="checkbox"/> Exigir revisão humana</label>
    <label><input {...register('businessHours')} type="checkbox"/> Somente horário comercial</label>
    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
      <strong>Resumo:</strong> <p>{getNaturalText()}</p>
    </div>
    <div className="action-row"><button disabled={busy} type="submit">{busy?'Salvando…':'Salvar política'}</button>{editing&&<button type="button" onClick={()=>setEditing(null)}>Cancelar</button>}</div></form><p role="status">{message}</p></section><section className="card"><h2>Simular elegibilidade</h2>{leads.length?<form className="stack-form" onSubmit={simulate}><label>Lead<select name="leadId">{leads.map(item=><option key={item.id} value={item.id}>@{item.username_current}</option>)}</select></label><label>Canal<select name="channel"><option value="instagram">Instagram</option><option value="threads">Threads</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></label><button disabled={busy}>Avaliar agora</button></form>:<EmptyState message="Não há leads na campanha para simular."/>}<p role="status">{decision}</p></section></div><section><h2>Políticas vigentes</h2>{policies.length?<div className="policy-grid">{policies.map(item=><article className="card" key={item.id}><header><StatusBadge status={item.enabled?'Ativa':'Pausada'}/><span>{item.campaign}</span></header><h3>{item.channel??'Todos os canais'}</h3><p>Intervalo mínimo de {Math.round(item.cadence_seconds/3600)} horas.</p><ul><li>Opt-out sempre respeitado</li><li>{item.rules?.requireHumanReview?'Com':'Sem'} revisão humana obrigatória</li><li>{item.rules?.businessHoursOnly?'Somente horário comercial':'Qualquer horário permitido'}</li></ul><button onClick={()=>setEditing(item)}>Editar</button></article>)}</div>:<EmptyState message="Nenhuma política cadastrada."/>}</section></main>}
