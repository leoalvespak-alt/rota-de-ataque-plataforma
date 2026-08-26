'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useKBar } from 'kbar'
import { Bell, BrainCircuit, FileText, LayoutDashboard, ListChecks, Menu, Moon, PanelLeftClose, PanelLeftOpen, Settings, Shield, Sun, TrendingUp, Users, X } from 'lucide-react'
import { LiveBadge, Tooltip } from '@plataforma/ui-bridge'
import { appPath, basePath } from '@/lib/base-path'
import type { CampaignOption } from '@/lib/campaign-context'
import { GlobalKillSwitchBanner } from './GlobalKillSwitchBanner'
import { NAVIGATION, isTemporalDestination } from '@/lib/navigation'
import { useTheme } from './ThemeProvider'
import { useSession } from './SessionProvider'

const icons = {
  home: LayoutDashboard,
  intelligence: BrainCircuit,
  decisions: ListChecks,
  content: FileText,
  relationship: Users,
  performance: TrendingUp,
  automations: Settings,
} as const

function relativePath(pathname: string) {
  if (basePath && pathname.startsWith(basePath)) return pathname.slice(basePath.length) || '/'
  return pathname || '/'
}

function NavContent({ current, collapsed, systemOnly = false }: { current: string; collapsed: boolean; systemOnly?: boolean }) {
  const destinations = NAVIGATION.filter((destination) => systemOnly ? destination.id === 'system' : destination.id !== 'system')
  return (
    <nav className="nav" aria-label="Navegação principal">
      <section className="nav-group">
        <h2>Áreas</h2>
        {destinations.map((destination) => {
          const href = destination.href
          const Icon = icons[destination.icon]
          const active = destination.href === '/' ? current === '/' : current === destination.href || current.startsWith(`${destination.href}/`)
          const link = <Link href={href} aria-current={active ? 'page' : undefined}><Icon size={19} aria-hidden /><span className="label">{destination.title}</span></Link>
          return collapsed ? <Tooltip key={destination.id} content={destination.title} side="right">{link}</Tooltip> : <div key={destination.id}>{link}</div>
        })}
      </section>
    </nav>
  )
}

function ThemeToggle() {
  const { theme, hydrated, toggleTheme } = useTheme()
  return <button className="theme-toggle" type="button" aria-label="Alternar tema claro ou escuro" aria-pressed={hydrated && theme === 'dark'} onClick={toggleTheme}>
    {hydrated && theme === 'dark' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    <span className="label">{hydrated ? (theme === 'dark' ? 'Tema claro' : 'Tema escuro') : 'Tema'}</span>
  </button>
}

export function AppShell({ children, campaigns, selectedCampaignId }: { children: ReactNode; campaigns: CampaignOption[]; selectedCampaignId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { query: commandQuery } = useKBar()
  const current = relativePath(pathname)
  const session = useSession()
  const [switching, setSwitching] = useState(false)
  const [health, setHealth] = useState({ connected: false, text: 'verificando' })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileWasOpen = useRef(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [recentNotifs, setRecentNotifs] = useState<{ id: string; message: string; created_at: string }[]>([])
  const selected = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0]
  const showPeriod = isTemporalDestination(current, searchParams.get('aba'))
  const period = searchParams.get('period') ?? '30d'

  useEffect(() => {
    setCollapsed(localStorage.getItem('prospector_sidebar_collapsed') === 'true')
  }, [])

  useEffect(() => {
    localStorage.setItem('prospector_sidebar_collapsed', collapsed.toString())
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen && mobileWasOpen.current) mobileTriggerRef.current?.focus()
    mobileWasOpen.current = mobileOpen
    if (!mobileOpen) return
    const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); return }
      if (event.key !== 'Tab') return
      const drawer = document.getElementById('prospector-mobile-drawer')
      if (!drawer) return
      const elements = Array.from(drawer.querySelectorAll<HTMLElement>(focusable))
      if (!elements.length) return
      const first = elements[0]!
      const last = elements[elements.length - 1]!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => document.getElementById('prospector-mobile-drawer')?.querySelector<HTMLElement>(focusable)?.focus(), 0)
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    const controller = new AbortController()
    fetch(appPath('/api/health/operational'), { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { at?: string; status?: string }
        const label = body.status === 'operational' ? 'Online' : body.status === 'degraded' ? 'Degradado' : body.status === 'unavailable' ? 'Indisponível' : 'Operação parada'
        setHealth({ connected: response.ok, text: body.at ? `${label} · ${new Date(body.at).toLocaleTimeString('pt-BR')}` : label })
      })
      .catch(() => { if (!controller.signal.aborted) setHealth({ connected: false, text: 'indisponível' }) })
    return () => controller.abort()
  }, [pathname])

  useEffect(() => {
    if (session.role !== 'admin') return
    const controller = new AbortController()
    const fetchCount = () => fetch(appPath('/api/admin/notifications/count'), { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ count: number; recent?: { id: string; message: string; created_at: string }[] }> : null)
      .then((data) => { if (data) { setNotifCount(data.count ?? 0); setRecentNotifs(data.recent ?? []) } })
      .catch(() => undefined)
    void fetchCount()
    const interval = setInterval(() => void fetchCount(), 60_000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [session.role])

  function changePeriod(newPeriod: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (newPeriod === '30d') params.delete('period')
    else params.set('period', newPeriod)
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  async function changeCampaign(campaignId: string) {
    setSwitching(true)
    try {
      const response = await fetch(appPath('/api/context/campaign'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId }) })
      if (!response.ok) throw new Error('Não foi possível trocar a campanha')
      router.refresh()
    } finally { setSwitching(false) }
  }

  if (current === '/login') return <main id="main-content">{children}</main>

  const account = <div className="account-card">
    <details className="campaign-switcher">
      <summary><span className="label">Campanha</span><strong>{selected?.name ?? 'Nenhuma campanha ativa'}</strong></summary>
      <label className="sr-only" htmlFor="campaign">Campanha ativa</label>
      <select id="campaign" value={selected?.id ?? ''} disabled={switching || campaigns.length === 0} onChange={(event) => void changeCampaign(event.target.value)}>
        {campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}
      </select>
    </details>
    <span className={`role ${session.role}`}>{session.role}</span>
    <small>{session.name}</small>
  </div>

  const sidebarNav = <>
    <NavContent current={current} collapsed={collapsed} />
    <div className="sidebar-system"><NavContent current={current} collapsed={collapsed} systemOnly /></div>
  </>

  const openCommands = () => commandQuery.toggle()

  return <div className={`shell ${collapsed ? 'sidebar-collapsed' : ''}`} data-sidebar-collapsed={collapsed}>
    <aside className="sidebar desktop-sidebar" aria-label="Menu lateral">
      <div className="brand"><span aria-hidden><Shield size={16} /></span><span className="label">Rota de Ataque</span></div>
      <div className="sidebar-search"><button type="button" onClick={openCommands}><span aria-hidden>⌕</span><span className="label">Buscar</span><kbd>⌘K</kbd></button></div>
      {sidebarNav}
      <div className="sidebar-footer">
        <ThemeToggle />
        <button className="sidebar-toggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}<span className="label">{collapsed ? 'Expandir' : 'Recolher'}</span>
        </button>
        {account}
      </div>
    </aside>

    {mobileOpen && <button className="mobile-overlay" type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <aside id="prospector-mobile-drawer" className="sidebar mobile-drawer" hidden={!mobileOpen} aria-hidden={!mobileOpen} aria-label="Menu móvel">
      <div className="mobile-drawer-header"><div className="brand"><span aria-hidden><Shield size={16} /></span>Rota de Ataque</div><button type="button" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={19} /></button></div>
      <div className="mobile-drawer-content">{sidebarNav}</div>
      <div className="sidebar-footer"><ThemeToggle />{account}</div>
    </aside>

    <div className="content">
      <header className="context-header">
        <button ref={mobileTriggerRef} className="mobile-menu-btn" type="button" onClick={() => setMobileOpen(true)} aria-controls="prospector-mobile-drawer" aria-label="Abrir menu" aria-expanded={mobileOpen}><Menu size={22} /></button>
        <div className="context-campaign"><small>Campanha ativa</small><strong>{selected?.name ?? 'Nenhuma campanha ativa'}</strong></div>
        <div className="context-actions">
          {showPeriod && <select aria-label="Período de análise" value={period} onChange={(event) => changePeriod(event.target.value)}><option value="7d">7 dias</option><option value="30d">30 dias</option><option value="90d">90 dias</option></select>}
          <button type="button" aria-label="Abrir comandos" onClick={openCommands}>Buscar <kbd>⌘K</kbd></button>
          {session.role === 'admin' && <div className="notification-wrap"><button type="button" aria-label={`Notificações${notifCount > 0 ? ` — ${notifCount} não lidas` : ''}`} aria-haspopup="dialog" aria-expanded={notifOpen} onClick={() => setNotifOpen((value) => !value)}><Bell size={17} />{notifCount > 0 && <span className="notification-count" aria-hidden>{notifCount > 9 ? '9+' : notifCount}</span>}</button>{notifOpen && <div className="notification-popover" role="dialog" aria-label="Notificações recentes"><header><strong>Incidentes recentes</strong><button type="button" onClick={() => setNotifOpen(false)} aria-label="Fechar"><X size={15} /></button></header>{recentNotifs.length ? recentNotifs.map((notification) => <div key={notification.id}><p>{notification.message}</p><small>{new Date(notification.created_at).toLocaleString('pt-BR')}</small></div>) : <p>Nenhuma notificação.</p>}<Link href="/sistema/incidentes" onClick={() => setNotifOpen(false)}>Abrir incidentes →</Link></div>}</div>}
          <LiveBadge connected={health.connected} lastUpdate={health.text} />
        </div>
      </header>
      <GlobalKillSwitchBanner />
      <main id="main-content">{children}</main>
    </div>
  </div>
}
