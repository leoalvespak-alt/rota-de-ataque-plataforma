'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from './SessionProvider'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LiveBadge, Tooltip } from '@plataforma/ui-bridge'
import { appPath, basePath } from '@/lib/base-path'
import type { CampaignOption } from '@/lib/campaign-context'
import { GlobalKillSwitchBanner } from './GlobalKillSwitchBanner'
import { NAVIGATION, isTemporalDestination, navigationHref } from '@/lib/navigation'
import { useUiMode } from './UiModeProvider'

import { 
  LayoutDashboard, BrainCircuit, ListChecks, Users, FileText, Calendar,
  MessageSquare, TrendingUp, Bot, Settings, Bell,
  Menu, PanelLeftClose, PanelLeftOpen, X
} from 'lucide-react'

const icons = {
  home: LayoutDashboard,
  intelligence: BrainCircuit,
  decisions: ListChecks,
  prospecting: Users,
  content: FileText,
  publishing: Calendar,
  relationship: MessageSquare,
  performance: TrendingUp,
  automations: Bot,
  settings: Settings,
} as const

function relativePath(pathname: string) {
  if (basePath && pathname.startsWith(basePath)) return pathname.slice(basePath.length) || '/'
  return pathname || '/'
}

function NavContent({ current, collapsed, advanced }: { current: string; collapsed: boolean; advanced: boolean }) {
  return (
    <nav className="nav" aria-label="Navegação principal">
      <section className="nav-group">
        <h2>Operação</h2>
        {NAVIGATION.filter((destination) => advanced || destination.tier === 'simple').map((destination) => {
            const href = navigationHref(destination, destination.tabs[0])
            const Icon = icons[destination.icon]
            const active = destination.href === '/' ? current === '/' : current === destination.href || current.startsWith(`${destination.href}/`)
            const linkContent = (
              <Link href={href} aria-current={active ? 'page' : undefined}>
                <Icon size={20} />
                <span className="label">{destination.title}</span>
              </Link> 
            )
            return collapsed ? (
              <Tooltip key={href} content={destination.title} side="right">
                {linkContent}
              </Tooltip>
            ) : (
              <div key={href}>{linkContent}</div>
            )
          })}
      </section>
    </nav>
  )
}

export function AppShell({ children, campaigns, selectedCampaignId }: { children: ReactNode; campaigns: CampaignOption[]; selectedCampaignId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = relativePath(pathname)
  const { mode, setMode } = useUiMode()
  const session = useSession()
  const [switching, setSwitching] = useState(false)
  const [health, setHealth] = useState({ connected: false, text: 'verificando' })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [recentNotifs, setRecentNotifs] = useState<{id: string; message: string; created_at: string}[]>([])
  const [modeNotice, setModeNotice] = useState(false)
  const selected = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0]

  // Period selector (only for temporal routes)
  const showPeriod = isTemporalDestination(current, searchParams.get('aba'))
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
    fetch(appPath('/api/health/operational'), { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const body = await response.json() as { at?: string; status?: string }
      const label = body.status === 'operational' ? 'Online' : body.status === 'degraded' ? 'Degradado' : body.status === 'unavailable' ? 'Indisponível' : 'Operação parada'
      setHealth({ connected: response.ok, text: body.at ? `${label} · ${new Date(body.at).toLocaleTimeString('pt-BR')}` : label })
    }).catch(() => { if (!controller.signal.aborted) setHealth({ connected: false, text: 'indisponível' }) })
    return () => controller.abort()
  }, [pathname])

  // Fetch notification count on an interval instead of every navigation
  useEffect(() => {
    if (session.role !== 'admin') {
      setNotifCount(0)
      setRecentNotifs([])
      return
    }
    const controller = new AbortController()
    const fetchCount = () => {
      fetch(appPath('/api/admin/notifications/count'), { cache: 'no-store', signal: controller.signal })
        .then(r => r.ok ? r.json() as Promise<{ count: number; recent?: {id: string; message: string; created_at: string}[] }> : null)
        .then(data => {
          if (data) {
            setNotifCount(data.count ?? 0)
            setRecentNotifs(data.recent ?? [])
          }
        })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60_000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [session.role])

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
      <NavContent current={current} collapsed={collapsed} advanced={mode === 'advanced'} />
      <div className="sidebar-footer">
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <button
          className="sidebar-toggle"
          aria-pressed={mode === 'advanced'}
          onClick={() => {
            const next = mode === 'simple' ? 'advanced' : 'simple'
            setMode(next)
            if (next === 'advanced' && localStorage.getItem('prospector_ui_mode_notice_seen') !== 'true') {
              localStorage.setItem('prospector_ui_mode_notice_seen', 'true')
              setModeNotice(true)
            }
          }}
        >
          <Settings size={18} /><span className="label">Modo {mode === 'simple' ? 'simples' : 'avançado'}</span>
        </button>
      </div>
      <div className="account-card">
        <label htmlFor="campaign">Campanha ativa</label>
        <select id="campaign" value={selected?.id ?? ''} disabled={switching || campaigns.length === 0} onChange={(event) => void changeCampaign(event.target.value)}>
          {campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}
        </select>
        <span className={`role ${session.role}`}>{session.role}</span>
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
        <NavContent current={current} collapsed={false} advanced={mode === 'advanced'} />
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
          {session.role === 'admin' && <div style={{ position: 'relative' }}>
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
                  <Link href="/automacoes?aba=notificacoes" style={{ fontSize: '13px', color: 'var(--accent-primary)' }} onClick={() => setNotifOpen(false)}>Ver todas →</Link>
                </div>
              </div>
            )}
          </div>}

          <LiveBadge connected={health.connected} lastUpdate={health.text}/>
        </div>
      </header>
      {modeNotice && <div className="bridge-inline-notice" role="status" style={{ margin: '8px 24px' }}>
        Nenhuma funcionalidade foi removida — as opções avançadas estão agora visíveis.
        <button type="button" onClick={() => setModeNotice(false)} aria-label="Fechar aviso" style={{ marginLeft: 12 }}><X size={14} /></button>
      </div>}
      <GlobalKillSwitchBanner />
      <main id="main-content">{children}</main>
    </div>
  </div>
}
