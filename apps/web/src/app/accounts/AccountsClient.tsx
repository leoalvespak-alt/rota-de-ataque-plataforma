'use client'

import { Dialog, HealthDial, InputField, IntegrationState, KpiCard, KpiRow, PageHeader, RoleBadge, EmptyState, SelectField, StatusBadge } from '@plataforma/ui-bridge'
import { useEffect, useState, useTransition } from 'react'
import type { IntegrationCapability } from '@/lib/integration-capabilities'
import { appPath } from '@/lib/base-path'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from '@plataforma/ui-bridge'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

interface Policy { action_type:string; enabled:boolean; daily_limit:number; hourly_limit:number; required_role:'collector'|'actor' }
interface Account { id:string; username:string; role:'collector'|'actor'; status:string; health_score:string|null; meta_token_expires_at:string|null; policies:Policy[] }
interface Competitor { id:string; username:string; campaign_id:string; campaign_name:string; weight:string; campaign_status:'active'|'paused'|'archived'; followers_count:number|null; last_synced_via_api_at:string|null }
interface Campaign { id:string; name:string }

const competitorSchema = z.object({
  campaignId: z.string().min(1, 'Campanha é obrigatória'),
  username: z.string().min(2, 'No mínimo 2 caracteres')
})
type CompetitorFormData = z.infer<typeof competitorSchema>

export function AccountsClient({ accounts:initialAccounts, competitors:initialCompetitors, campaigns, capabilities, freshness = [], nba = [], history = [], notice }:{ accounts:Account[]; competitors:Competitor[]; campaigns:Campaign[]; capabilities:IntegrationCapability[]; freshness?:Array<{id:string;username:string;role:string;status:string;last_checked:string|null}>; nba?:Array<{id:string;suggested_action:string|null;chosen_channel:string|null;confidence:string|null;status:string;username_current:string|null}>; history?:Array<{action:string;target:string;created_at:string}>; notice?:string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'connections'
  const [isPending, startTransition] = useTransition()

  const [accounts, setAccounts] = useState(initialAccounts)
  const [competitors, setCompetitors] = useState(initialCompetitors)
  const [validation, setValidation] = useState('')
  
  const [wizardOpen, setWizardOpen] = useState(false)

  const { register, handleSubmit, control, formState: { errors } } = useForm<CompetitorFormData>({
    resolver: zodResolver(competitorSchema),
    defaultValues: {
      campaignId: campaigns[0]?.id ?? '',
      username: ''
    }
  })

  const usernameValue = useWatch({ control, name: 'username' })

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!usernameValue || usernameValue.length < 2) { setValidation(''); return }
      const normalized = usernameValue.replace(/^@/, '')
      const response = await fetch(appPath(`/api/admin/competitors/validate?username=${encodeURIComponent(normalized)}`))
      const data = await response.json() as { valid?: boolean }
      setValidation(data.valid === true ? '✅ Conta encontrada' : data.valid === false ? '⚠ Conta não encontrada' : '⚠ Validação Meta indisponível')
    }, !usernameValue || usernameValue.length < 2 ? 0 : 500)
    return () => clearTimeout(timer)
  }, [usernameValue])

  async function togglePolicy(account:Account, policy:Policy) {
    const enabled = !policy.enabled
    const response = await fetch(appPath(`/api/admin/accounts/${account.id}/policies`), { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ actionType:policy.action_type, enabled, dailyLimit:policy.daily_limit, hourlyLimit:policy.hourly_limit }) })
    if (response.ok) setAccounts((items) => items.map((item) => item.id === account.id ? { ...item, policies:item.policies.map((current) => current.action_type === policy.action_type ? { ...current, enabled } : current) } : item))
  }

  async function onSubmitCompetitor(data: CompetitorFormData) {
    const response = await fetch(appPath('/api/admin/competitors'), { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ campaignId: data.campaignId, username: data.username, weight:1 }) })
    if (response.ok) location.reload()
  }

  async function updateCompetitor(item:Competitor, patch:{ status?:string; weight?:number }) {
    const response = await fetch(appPath('/api/admin/competitors'), { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ campaignId:item.campaign_id, competitorId:item.id, ...patch }) })
    if (response.ok) setCompetitors((items) => items.map((value) => value.id === item.id && value.campaign_id === item.campaign_id ? { ...value, ...patch, weight:String(patch.weight ?? value.weight), campaign_status:(patch.status ?? value.campaign_status) as Competitor['campaign_status'] } : value))
  }

  function changeTab(nextTab: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab !== 'connections') params.set('tab', nextTab)
    else params.delete('tab')
    
    startTransition(() => {
      router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
    })
  }
  
  function triggerOAuthFlow() {
    setWizardOpen(false)
    toast.success('Redirecionando para o OAuth Provider da Meta...')
    setTimeout(() => {
      window.location.href = appPath('/api/meta/oauth/start?role=collector')
    }, 1500)
  }

  return <div className="page">
    <PageHeader title="Contas e Configurações" subtitle="Integrações, políticas, saúde e concorrentes monitorados" />
    {notice && <p className="banner" role="status">{notice}</p>}
    
    <div role="tablist" aria-label="Seções de contas" style={{ display: 'flex', gap: 'var(--space-4)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
      {(['connections', 'freshness', 'nba', 'history'] as const).map((t, index) => (
        <button 
          key={t}
          role="tab"
          id={`accounts-tab-${t}`}
          aria-selected={tab === t}
          aria-controls={`accounts-panel-${t}`}
          tabIndex={tab === t ? 0 : -1}
          onClick={() => changeTab(t)}
          onKeyDown={(event) => { if (event.key === 'ArrowRight') changeTab((['connections', 'freshness', 'nba', 'history'] as const)[(index + 1) % 4] ?? 'connections'); if (event.key === 'ArrowLeft') changeTab((['connections', 'freshness', 'nba', 'history'] as const)[(index + 3) % 4] ?? 'connections') }}
          style={{ padding: 'var(--space-2) var(--space-4)', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent', color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: tab === t ? 'bold' : 'normal' }}
        >
          {t === 'connections' ? 'Conexões (Contas)' : t === 'freshness' ? 'Frescor de Dados' : t === 'nba' ? 'Next Best Action' : 'Histórico'}
        </button>
      ))}
    </div>
    
    {tab === 'connections' && (
      <>
        <section id="accounts-panel-connections" role="tabpanel" aria-labelledby="accounts-tab-connections">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Integrações</h2>
            <button className="bridge-button" data-variant="primary" onClick={() => setWizardOpen(true)}>Nova Integração</button>
          </div>
          <div className="integration-grid" style={{ marginTop: 'var(--space-4)' }}>{capabilities.map((capability)=><IntegrationState key={capability.id} name={capability.name} status={capability.status} detail={capability.detail}/>)}</div>
        </section>
        
        <div className="account-grid" style={{ marginTop: 'var(--space-6)' }}>{(['collector','actor'] as const).map((role) => {
          const account = accounts.find((item) => item.role === role)
          return <section className="card account-large" key={role}>
            {account && ['CHECKPOINT','STOPPED'].includes(account.status) && <div className="danger-banner">Conta interrompida · <a href={appPath('/docs/runbooks/accounts')}>Ver runbook</a></div>}
            <header><RoleBadge role={role}/><HealthDial value={Math.round(Number(account?.health_score ?? 0))} state={account?.status ?? 'AUTH_REQUIRED'}/></header>
            <h2>{account?.username ? `@${account.username}` : 'Não vinculada'}</h2>
            <KpiRow><KpiCard label="Status" value={account?.status ?? 'AUTH_REQUIRED'}/><KpiCard label="Token" value={account?.meta_token_expires_at ? new Date(account.meta_token_expires_at).toLocaleDateString('pt-BR') : 'ausente'}/></KpiRow>
            <a className="runbook" href={appPath(`/api/meta/oauth/start?role=${role}`)}>{account?.meta_token_expires_at ? 'Renovar vínculo Meta' : 'Vincular Meta'}</a>
            <h3>Políticas</h3>
            {account?.policies.map((policy) => {
              const compatible = policy.required_role === role
              return <label className="policy-row" title={compatible ? '' : 'Incompatível com o papel da conta'} key={policy.action_type}><input type="checkbox" checked={policy.enabled} disabled={!compatible} onChange={() => void togglePolicy(account, policy)}/><span>{policy.action_type}</span><small>{policy.daily_limit}/dia</small></label>
            })}
          </section>
        })}</div>
        <section className="card competitors" style={{ marginTop: 'var(--space-6)' }}>
          <h2>Concorrentes</h2>
          <form onSubmit={handleSubmit(onSubmitCompetitor)}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <SelectField label="Campanha" {...register('campaignId')}>
                  {campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </SelectField>
                {errors.campaignId && <span role="alert" style={{color: 'var(--status-error)', fontSize: '12px'}}>{errors.campaignId.message}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <InputField label="Username do concorrente" {...register('username')} placeholder="@username" />
                {errors.username && <span role="alert" style={{color: 'var(--status-error)', fontSize: '12px'}}>{errors.username.message}</span>}
              </div>
              <span style={{ padding: '8px 0' }}>{validation}</span>
              <button>Adicionar</button>
            </div>
          </form>
          {competitors.map((item) => <div className="competitor-row" key={`${item.campaign_id}:${item.id}`}><strong>@{item.username}</strong><span>{item.campaign_name}</span><span>{item.followers_count ?? '—'} seguidores</span><select aria-label={`Status de @${item.username}`} value={item.campaign_status} onChange={(event) => void updateCompetitor(item, { status:event.target.value })}><option value="active">Ativo</option><option value="paused">Pausado</option><option value="archived">Arquivado</option></select><label>Peso <input type="range" min="0" max="5" step="0.1" value={item.weight} onChange={(event) => void updateCompetitor(item, { weight:Number(event.target.value) })}/>{Number(item.weight).toFixed(1)}</label></div>)}
        </section>
      </>
    )}
    
    {tab === 'freshness' && (
      <section id="accounts-panel-freshness" role="tabpanel" aria-labelledby="accounts-tab-freshness"><h2>Frescor de dados das contas</h2><p>Mostra a última verificação persistida; uma conta sem verificação exige reconexão ou execução do worker de sincronização.</p>{freshness.length?<div className="record-list">{freshness.map(item=><div key={item.id}><strong>{item.role} · @{item.username}</strong><span>{item.last_checked?`Última verificação: ${new Date(item.last_checked).toLocaleString('pt-BR')}`:'Ainda sem verificação de saúde'}</span><StatusBadge status={item.status}/></div>)}</div>:<EmptyState message="Nenhuma conta vinculada para medir frescor."/>}</section>
    )}
    {tab === 'nba' && (
      <section id="accounts-panel-nba" role="tabpanel" aria-labelledby="accounts-tab-nba"><h2>Next Best Action</h2><p>Recomendações calculadas pelo motor, apresentadas para revisão — não executam contato automaticamente.</p>{nba.length?<div className="record-list">{nba.map(item=><div key={item.id}><strong>{item.suggested_action??'Ação sem descrição'} {item.username_current?`· @${item.username_current}`:''}</strong><span>{item.chosen_channel??'Canal ainda não escolhido'} · confiança {item.confidence??'—'}</span><StatusBadge status={item.status}/></div>)}</div>:<EmptyState message="Ainda não há recomendações. Ative o worker NBA para uma campanha com leads elegíveis."/>}</section>
    )}
    {tab === 'history' && (
      <section id="accounts-panel-history" role="tabpanel" aria-labelledby="accounts-tab-history"><h2>Histórico de configuração</h2>{history.length?<div className="record-list">{history.map((item,index)=><div key={`${item.created_at}:${index}`}><strong>{item.action}</strong><span>{item.target} · {new Date(item.created_at).toLocaleString('pt-BR')}</span></div>)}</div>:<EmptyState message="Nenhuma alteração auditada até o momento."/>}</section>
    )}

    <Dialog open={wizardOpen} onOpenChange={setWizardOpen} title="Assistente de Nova Integração (OAuth)">
      <p style={{ margin: '0 0 var(--space-4)', color: 'var(--text-secondary)' }}>Selecione o provedor para autorizar acesso seguro.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <button className="bridge-button" data-variant="secondary" onClick={triggerOAuthFlow}>Meta (Instagram / WhatsApp)</button>
        <p className="bridge-inline-notice">Salesforce não é uma integração suportada neste produto; por isso não há ação de conexão disponível.</p>
      </div>
      <div style={{ marginTop: 'var(--space-6)', textAlign: 'right' }}>
        <button className="bridge-button" data-variant="outline" onClick={() => setWizardOpen(false)}>Cancelar</button>
      </div>
    </Dialog>
  </div>
}
