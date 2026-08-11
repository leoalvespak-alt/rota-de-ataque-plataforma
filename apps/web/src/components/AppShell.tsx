'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LiveBadge, RoleBadge } from '@plataforma/ui-bridge'
import { appPath, basePath } from '@/lib/base-path'
import type { CampaignOption } from '@/lib/campaign-context'

const groups = [
  { label: 'Visão', links: [['/', 'Overview']] },
  { label: 'Prospecção', links: [['/leads', 'Leads'], ['/review-inbox', 'Review Inbox'], ['/timeline', 'Timeline'], ['/identities', 'Identidades']] },
  { label: 'Inteligência', links: [['/radar', 'Radar'], ['/market-radar', 'Radar de mercado'], ['/competitive-intel', 'Inteligência competitiva'], ['/community', 'Comunidades']] },
  { label: 'Conteúdo', links: [['/theses', 'Teses'], ['/content-opportunity', 'Oportunidades'], ['/content-items', 'Conteúdos'], ['/creative-bridge', 'Creative Bridge'], ['/publishing', 'Publicação']] },
  { label: 'Canais', links: [['/email-flows', 'Fluxos de e-mail'], ['/communities', 'Grupos WhatsApp'], ['/conversations', 'Conversas']] },
  { label: 'Governança', links: [['/contact-policies', 'Políticas de contato'], ['/engagement-queue', 'Fila de engagement']] },
  { label: 'Sistema', links: [['/accounts', 'Contas e integrações'], ['/configs', 'Configurações'], ['/source-roi', 'ROI por origem'], ['/notifications', 'Notificações e erros'], ['/system-health', 'Saúde do sistema']] },
] as const

function relativePath(pathname: string) {
  if (basePath && pathname.startsWith(basePath)) return pathname.slice(basePath.length) || '/'
  return pathname || '/'
}

export function AppShell({ children, campaigns, selectedCampaignId }: { children: ReactNode; campaigns: CampaignOption[]; selectedCampaignId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const current = relativePath(pathname)
  const [commandOpen, setCommandOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [switching, setSwitching] = useState(false)
  const [health, setHealth] = useState({ connected: false, text: 'verificando' })
  const selected = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0]

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen((open) => !open) }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch(appPath('/api/health'), { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const body = await response.json() as { at?: string }
      setHealth({ connected: response.ok, text: body.at ? new Date(body.at).toLocaleTimeString('pt-BR') : response.ok ? 'agora' : 'indisponível' })
    }).catch(() => { if (!controller.signal.aborted) setHealth({ connected: false, text: 'indisponível' }) })
    return () => controller.abort()
  }, [pathname])

  const commands = useMemo(() => groups.flatMap((group) => group.links.map(([href, label]) => ({ href, label, group: group.label }))).filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(command.toLowerCase())), [command])
  if (current === '/login') return <main id="content">{children}</main>

  async function changeCampaign(campaignId: string) {
    setSwitching(true)
    try {
      const response = await fetch(appPath('/api/context/campaign'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId }) })
      if (!response.ok) throw new Error('Não foi possível trocar a campanha')
      router.refresh()
    } finally { setSwitching(false) }
  }

  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span aria-hidden>◆</span><span className="label">Rota de Ataque</span></div><nav className="nav" aria-label="Navegação principal">{groups.map((group) => <section className="nav-group" key={group.label}><h2>{group.label}</h2>{group.links.map(([href, label]) => { const active = href === '/' ? current === '/' : current === href || current.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? 'page' : undefined}><span aria-hidden>◇</span><span className="label">{label}</span></Link> })}</section>)}</nav><div className="account-card"><label htmlFor="campaign">Campanha ativa</label><select id="campaign" value={selected?.id ?? ''} disabled={switching || campaigns.length === 0} onChange={(event) => void changeCampaign(event.target.value)}>{campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}</select><RoleBadge role="actor"/></div></aside>
    <div className="content"><header className="context-header"><div><small>Campanha</small><strong>{selected?.name ?? 'Nenhuma campanha ativa'}</strong></div><button type="button" onClick={() => setCommandOpen(true)} aria-label="Abrir comandos">Buscar <kbd>Ctrl K</kbd></button><LiveBadge connected={health.connected} lastUpdate={health.text}/></header><main id="content">{children}</main></div>
    {commandOpen && <div className="command-backdrop" role="presentation" onMouseDown={() => setCommandOpen(false)}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Comandos" onMouseDown={(event) => event.stopPropagation()}><label htmlFor="command-search">Ir para</label><input id="command-search" autoFocus value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Busque uma página…"/><div>{commands.map((item) => <button type="button" key={item.href} onClick={() => { setCommandOpen(false); router.push(item.href) }}><span>{item.label}</span><small>{item.group}</small></button>)}</div>{commands.length === 0 && <p>Nenhuma página encontrada.</p>}</section></div>}
  </div>
}
