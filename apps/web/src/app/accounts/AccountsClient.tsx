'use client'

import { HealthDial, IntegrationState, KpiCard, KpiRow, PageHeader, RoleBadge } from '@plataforma/ui-bridge'
import { useEffect, useState } from 'react'
import type { IntegrationCapability } from '@/lib/integration-capabilities'
import { appPath } from '@/lib/base-path'

interface Policy { action_type:string; enabled:boolean; daily_limit:number; hourly_limit:number; required_role:'collector'|'actor' }
interface Account { id:string; username:string; role:'collector'|'actor'; status:string; health_score:string|null; meta_token_expires_at:string|null; policies:Policy[] }
interface Competitor { id:string; username:string; campaign_id:string; campaign_name:string; weight:string; campaign_status:'active'|'paused'|'archived'; followers_count:number|null; last_synced_via_api_at:string|null }
interface Campaign { id:string; name:string }

export function AccountsClient({ accounts:initialAccounts, competitors:initialCompetitors, campaigns, capabilities, notice }:{ accounts:Account[]; competitors:Competitor[]; campaigns:Campaign[]; capabilities:IntegrationCapability[]; notice?:string }) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [competitors, setCompetitors] = useState(initialCompetitors)
  const [username, setUsername] = useState('')
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [validation, setValidation] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username.length < 2) { setValidation(''); return }
      const normalized = username.replace(/^@/, '')
      const response = await fetch(`/prospector/api/admin/competitors/validate?username=${encodeURIComponent(normalized)}`)
      const data = await response.json() as { valid?: boolean }
      setValidation(data.valid === true ? '✅ Conta encontrada' : data.valid === false ? '⚠ Conta não encontrada' : '⚠ Validação Meta indisponível')
    }, username.length < 2 ? 0 : 500)
    return () => clearTimeout(timer)
  }, [username])

  async function togglePolicy(account:Account, policy:Policy) {
    const enabled = !policy.enabled
    const response = await fetch(`/prospector/api/admin/accounts/${account.id}/policies`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ actionType:policy.action_type, enabled, dailyLimit:policy.daily_limit, hourlyLimit:policy.hourly_limit }) })
    if (response.ok) setAccounts((items) => items.map((item) => item.id === account.id ? { ...item, policies:item.policies.map((current) => current.action_type === policy.action_type ? { ...current, enabled } : current) } : item))
  }

  async function addCompetitor(event:React.FormEvent) {
    event.preventDefault()
    const response = await fetch('/prospector/api/admin/competitors', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ campaignId, username, weight:1 }) })
    if (response.ok) location.reload()
  }

  async function updateCompetitor(item:Competitor, patch:{ status?:string; weight?:number }) {
    const response = await fetch('/prospector/api/admin/competitors', { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ campaignId:item.campaign_id, competitorId:item.id, ...patch }) })
    if (response.ok) setCompetitors((items) => items.map((value) => value.id === item.id && value.campaign_id === item.campaign_id ? { ...value, ...patch, weight:String(patch.weight ?? value.weight), campaign_status:(patch.status ?? value.campaign_status) as Competitor['campaign_status'] } : value))
  }

  return <div className="page">
    <PageHeader title="Contas Meta" subtitle="Papéis fixos, políticas, saúde e concorrentes monitorados" />
    {notice && <p className="banner" role="status">{notice}</p>}
    <section><h2>Integrações</h2><div className="integration-grid">{capabilities.map((capability)=><IntegrationState key={capability.id} name={capability.name} status={capability.status} detail={capability.detail}/>)}</div></section>
    <div className="account-grid">{(['collector','actor'] as const).map((role) => {
      const account = accounts.find((item) => item.role === role)
      return <section className="card account-large" key={role}>
        {account && ['CHECKPOINT','STOPPED'].includes(account.status) && <div className="danger-banner">Conta interrompida · <a href={appPath('/docs/runbooks/accounts')}>Ver runbook</a></div>}
        <header><RoleBadge role={role}/><HealthDial value={Math.round(Number(account?.health_score ?? 0))} state={account?.status ?? 'AUTH_REQUIRED'}/></header>
        <h2>{account?.username ? `@${account.username}` : 'Não vinculada'}</h2>
        <KpiRow><KpiCard label="Status" value={account?.status ?? 'AUTH_REQUIRED'}/><KpiCard label="Token" value={account?.meta_token_expires_at ? new Date(account.meta_token_expires_at).toLocaleDateString('pt-BR') : 'ausente'}/></KpiRow>
        <a className="runbook" href={`/prospector/api/meta/oauth/start?role=${role}`}>{account?.meta_token_expires_at ? 'Renovar vínculo Meta' : 'Vincular Meta'}</a>
        <h3>Políticas</h3>
        {account?.policies.map((policy) => {
          const compatible = policy.required_role === role
          return <label className="policy-row" title={compatible ? '' : 'Incompatível com o papel da conta'} key={policy.action_type}><input type="checkbox" checked={policy.enabled} disabled={!compatible} onChange={() => void togglePolicy(account, policy)}/><span>{policy.action_type}</span><small>{policy.daily_limit}/dia</small></label>
        })}
      </section>
    })}</div>
    <section className="card competitors">
      <h2>Concorrentes</h2>
      <form onSubmit={addCompetitor}><select aria-label="Campanha" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>{campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="Username do concorrente" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@username" required/><span>{validation}</span><button>Adicionar</button></form>
      {competitors.map((item) => <div className="competitor-row" key={`${item.campaign_id}:${item.id}`}><strong>@{item.username}</strong><span>{item.campaign_name}</span><span>{item.followers_count ?? '—'} seguidores</span><select aria-label={`Status de @${item.username}`} value={item.campaign_status} onChange={(event) => void updateCompetitor(item, { status:event.target.value })}><option value="active">Ativo</option><option value="paused">Pausado</option><option value="archived">Arquivado</option></select><label>Peso <input type="range" min="0" max="5" step="0.1" value={item.weight} onChange={(event) => void updateCompetitor(item, { weight:Number(event.target.value) })}/>{Number(item.weight).toFixed(1)}</label></div>)}
    </section>
  </div>
}
