'use client'

import { HealthDial, IntegrationState, KpiCard, KpiRow, PageHeader, RoleBadge, EmptyState } from '@plataforma/ui-bridge'
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

export function AccountsClient({ accounts:initialAccounts, competitors:initialCompetitors, campaigns, capabilities, notice }:{ accounts:Account[]; competitors:Competitor[]; campaigns:Campaign[]; capabilities:IntegrationCapability[]; notice?:string }) {
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
    
    <div style={{ display: 'flex', gap: 'var(--space-4)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
      {['connections', 'freshness', 'nba', 'history'].map(t => (
        <button 
          key={t}
          onClick={() => changeTab(t)}
          style={{ padding: 'var(--space-2) var(--space-4)', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent', color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: tab === t ? 'bold' : 'normal' }}
        >
          {t === 'connections' ? 'Conexões (Contas)' : t === 'freshness' ? 'Frescor de Dados' : t === 'nba' ? 'Next Best Action' : 'Histórico'}
        </button>
      ))}
    </div>
    
    {tab === 'connections' && (
      <>
        <section>
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
                <select aria-label="Campanha" {...register('campaignId')}>
                  {campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {errors.campaignId && <span style={{color: 'var(--status-error)', fontSize: '12px'}}>{errors.campaignId.message}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <input aria-label="Username do concorrente" {...register('username')} placeholder="@username" />
                {errors.username && <span style={{color: 'var(--status-error)', fontSize: '12px'}}>{errors.username.message}</span>}
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
      <EmptyState message="Políticas de Frescor (Freshness): Defina aqui as janelas de re-sincronização automática para leads inativos." />
    )}
    {tab === 'nba' && (
      <EmptyState message="Next Best Action (NBA): Configure os motores de recomendação e limiares de score aqui." />
    )}
    {tab === 'history' && (
      <EmptyState message="Histórico de Configuração: Log de auditoria de alterações sistêmicas." />
    )}

    {wizardOpen && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div className="card" style={{ width: '400px', background: 'var(--bg-default)' }}>
          <h2>Assistente de Nova Integração (OAuth)</h2>
          <p style={{ margin: 'var(--space-4) 0', color: 'var(--text-secondary)' }}>Selecione o provedor para autorizar acesso seguro.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <button className="bridge-button" data-variant="secondary" onClick={triggerOAuthFlow}>Meta (Instagram / WhatsApp)</button>
            <button className="bridge-button" data-variant="secondary" disabled>Salesforce (Em Breve)</button>
          </div>
          <div style={{ marginTop: 'var(--space-6)', textAlign: 'right' }}>
            <button className="bridge-button" data-variant="outline" onClick={() => setWizardOpen(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    )}
  </div>
}
