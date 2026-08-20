'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from './SessionProvider'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LiveBadge, RoleBadge, Tooltip } from '@plataforma/ui-bridge'
import { appPath, basePath } from '@/lib/base-path'
import type { CampaignOption } from '@/lib/campaign-context'

import { 
  LayoutDashboard, Users, Inbox, Clock, Fingerprint, 
  Radar, Radio, Swords, Network, 
  Lightbulb, Sparkles, FileText, Palette, Calendar, 
  MessageSquare, Mail, Phone, 
  Shield, ListTodo, 
  Link as LinkIcon, Bot, Settings, TrendingUp, Bell, Activity,
  Menu, PanelLeftClose, PanelLeftOpen, X
} from 'lucide-react'

const groups = [
  { label: 'Visão', links: [['/', 'Overview', LayoutDashboard]] },
  { label: 'Prospecção', links: [['/leads', 'Leads', Users], ['/review-inbox', 'Review Inbox', Inbox], ['/timeline', 'Timeline', Clock], ['/identities', 'Identidades', Fingerprint]] },
  { label: 'Inteligência', links: [['/radar', 'Radar', Radar], ['/market-radar', 'Radar de mercado', Radio], ['/competitive-intel', 'Inteligência competitiva', Swords], ['/community', 'Comunidades', Network]] },
  { label: 'Conteúdo', links: [['/theses', 'Teses', Lightbulb], ['/content-opportunity', 'Oportunidades', Sparkles], ['/content-items', 'Conteúdos', FileText], ['/creative-bridge', 'Creative Bridge', Palette], ['/publishing', 'Publicação', Calendar]] },
  { label: 'Canais', links: [['/email-flows', 'Fluxos de e-mail', Mail], ['/communities', 'Grupos WhatsApp', Phone], ['/conversations', 'Conversas', MessageSquare]] },
  { label: 'Governança', links: [['/contact-policies', 'Políticas de contato', Shield], ['/engagement-queue', 'Fila de engagement', ListTodo]] },
  { label: 'Sistema', links: [['/accounts', 'Contas e integrações', LinkIcon], ['/ai-settings', 'Modelos de IA', Bot], ['/configs', 'Configurações', Settings], ['/source-roi', 'ROI por origem', TrendingUp], ['/notifications', 'Notificações e erros', Bell], ['/system-health', 'Saúde do sistema', Activity]] },
] as const

// Routes where the period selector is shown
const TEMPORAL_ROUTES = ['/', '/radar', '/community', '/competitive-intel', '/timeline']

interface Session {
  name: string
  role: string
  avatarUrl?: string
}

  

function relativePath(pathname: string) {
  if (basePath && pathname.startsWith(basePath)) return pathname.slice(basePath.length) || '/'
  return pathname || '/'
}

function NavContent({ current, collapsed }: { current: string; collapsed: boolean }) {
  return (
    <nav className="nav" aria-label="Navegação principal">
      {groups.map((group) => (
        <section className="nav-group" key={group.label}>
          <h2>{group.label}</h2>
          {group.links.map(([href, label, Icon]) => { 
            const active = href === '/' ? current === '/' : current === href || current.startsWith(`${href}/`);
            const linkContent = (
              <Link href={href} aria-current={active ? 'page' : undefined}>
                <Icon size={20} />
                <span className="label">{label}</span>
              </Link> 
            )
            return collapsed ? (
              <Tooltip key={href} content={label} side="right">
                {linkContent}
              </Tooltip>
            ) : (
              <div key={href}>{linkContent}</div>
            )
          })}
        </section>
      ))}
    </nav>
  )
}

export function AppShell({ children, campaigns, selectedCampaignId }: { children: ReactNode; campaigns: CampaignOption[]; selectedCampaignId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = relativePath(pathname)
  const session = useSession()
  const [switching, setSwitching] = useState(false)
  const [health, setHealth] = useState({ connected: false, text: 'verificando' })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [recentNotifs, setRecentNotifs] = useState<{id: string; message: string; created_at: string}[]>([])
  const selected = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0]

  // Period selector (only for temporal routes)
  const showPeriod = TEMPORAL_ROUTES.includes(current)
  const period = searchParams.get('period') ?? '30d'

  useEffect(() => {
    const saved = localStorage.getItem('prospector_sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('prospector_sidebar_collapsed', collapsed.toString())
  }, [collapsed])

  useEffect(() => {
    const controller = new AbortController()
    fetch(appPath('/api/health'), { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const body = await response.json() as { at?: string }
      setHealth({ connected: response.ok, text: body.at ? new Date(body.at).toLocaleTimeString('pt-BR') : response.ok ? 'agora' : 'indisponível' })
    }).catch(() => { if (!controller.signal.aborted) setHealth({ connected: false, text: 'indisponível' }) })
    return () => controller.abort()
  }, [pathname])

  // Fetch notification count
  useEffect(() => {
    let cancelled = false
    fetch(appPath('/api/admin/notifications/count'), { cache: 'no-store' })
      .then(r => r.json() as Promise<{ count: number; recent?: {id: string; message: string; created_at: string}[] }>)
      .then(data => {
        if (!cancelled) {
          setNotifCount(data.count ?? 0)
          setRecentNotifs(data.recent ?? [])
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [pathname])

  function changePeriod(newPeriod: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (newPeriod === '30d') params.delete('period')
    else params.set('period', newPeriod)
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  if (current === '/login') return <main id="main-content">{children}</main>

  async function changeCampaign(campaignId: string) {
    setSwitching(true)
    try {
      const response = await fetch(appPath('/api/context/campaign'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId }) })
      if (!response.ok) throw new Error('Não foi possível trocar a campanha')
      router.refresh()
    } finally { setSwitching(false) }
  }

  return <div className={`shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    {/* Desktop sidebar */}
    <aside className="sidebar" aria-label="Menu lateral">
      <div className="brand">
        <span aria-hidden>◆</span>
        <span className="label">Rota de Ataque</span>
      </div>
      <NavContent current={current} collapsed={collapsed} />
      <div className="sidebar-footer">
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>
      <div className="account-card">
        <label htmlFor="campaign">Campanha ativa</label>
        <select id="campaign" value={selected?.id ?? ''} disabled={switching || campaigns.length === 0} onChange={(event) => void changeCampaign(event.target.value)}>
          {campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}
        </select>
        <RoleBadge role={session.role as 'actor' | 'collector'}/>
        <small style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{session.name}</small>
      </div>
    </aside>

    {/* Mobile drawer overlay */}
    {mobileOpen && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)' }}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
    )}
    <aside
      className="sidebar mobile-drawer"
      style={{
        position: 'fixed', top: 0, left: 0, height: '100vh',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        zIndex: 201,
        display: 'flex', flexDirection: 'column'
      }}
      aria-label="Menu móvel"
      aria-hidden={!mobileOpen}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <span className="brand" style={{ fontSize: '18px', fontWeight: 800 }}>◆ Rota de Ataque</span>
        <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <NavContent current={current} collapsed={false} />
      </div>
    </aside>

    <div className="content">
      <header className="context-header">
        {/* Mobile hamburger */}
        <button
          className="mobile-menu-btn"
          style={{ display: 'none' }}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={22} />
        </button>

        <div>
          <small>Campanha</small>
          <strong>{selected?.name ?? 'Nenhuma campanha ativa'}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Period selector — only for temporal routes */}
          {showPeriod && (
            <select
              aria-label="Período de análise"
              value={period}
              onChange={e => changePeriod(e.target.value)}
              style={{ height: '36px', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 8px', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: '13px' }}
            >
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="90d">90 dias</option>
            </select>
          )}

          <button type="button" aria-label="Abrir comandos" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
            Buscar <kbd>Ctrl K</kbd>
          </button>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              aria-label={`Notificações${notifCount > 0 ? ` — ${notifCount} não lidas` : ''}`}
              aria-haspopup="true"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen(v => !v)}
              style={{ position: 'relative', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
            >
              <Bell size={18} />
              {notifCount > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', top: '-6px', right: '-6px',
                    background: 'var(--status-error)', color: 'white',
                    borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                    minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px'
                  }}
                >
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                role="dialog"
                aria-label="Notificações recentes"
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '320px',
                  background: 'var(--surface-card)', border: '1px solid var(--border)',
                  borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                  zIndex: 100, overflow: 'hidden'
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Notificações</strong>
                  <button onClick={() => setNotifOpen(false)} aria-label="Fechar"><X size={16} /></button>
                </div>
                <div>
                  {recentNotifs.length > 0 ? recentNotifs.map(n => (
                    <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                      <p style={{ margin: 0 }}>{n.message}</p>
                      <small style={{ color: 'var(--text-tertiary)' }}>{new Date(n.created_at).toLocaleString('pt-BR')}</small>
                    </div>
                  )) : (
                    <p style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center' }}>Nenhuma notificação.</p>
                  )}
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <Link href="/notifications" style={{ fontSize: '13px', color: 'var(--accent-primary)' }} onClick={() => setNotifOpen(false)}>Ver todas →</Link>
                </div>
              </div>
            )}
          </div>

          <LiveBadge connected={health.connected} lastUpdate={health.text}/>
        </div>
      </header>
      <main id="main-content">{children}</main>
    </div>
  </div>
}
