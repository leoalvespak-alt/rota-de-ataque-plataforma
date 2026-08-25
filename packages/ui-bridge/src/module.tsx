import type { ReactNode } from 'react'

export type MetricViewModel = {
  label: string
  value: string | number
  unit?: string
  period?: string
  comparison?: string
  trend?: 'up' | 'down' | 'neutral'
  sourceStatus?: 'ready' | 'degraded' | 'blocked' | 'not_measured'
  href?: string
}

export function ModuleHeader({ eyebrow, title, subtitle, context, actions }: { eyebrow: string; title: string; subtitle?: string; context?: string; actions?: ReactNode }) {
  return <header className="module-header bridge-page-header"><div><p className="module-eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}{context && <small className="module-meta">{context}</small>}</div>{actions && <div className="bridge-page-header-actions">{actions}</div>}</header>
}

export function MetricStrip({ metrics }: { metrics: MetricViewModel[] }) {
  if (!metrics.length) return null
  return <section className="bridge-kpi-row" aria-label="Métricas principais">{metrics.map((metric) => <article className="bridge-kpi-card" key={metric.label}><div className="bridge-kpi-header"><span className="bridge-kpi-label">{metric.label}</span>{metric.sourceStatus && <span className={`source-status ${metric.sourceStatus}`}>{metric.sourceStatus === 'ready' ? 'fonte pronta' : metric.sourceStatus === 'degraded' ? 'degradado' : metric.sourceStatus === 'blocked' ? 'bloqueado' : 'não medido'}</span>}</div><strong className="bridge-kpi-value">{metric.href ? <a href={metric.href}>{metric.value}</a> : metric.value}{metric.unit && <small> {metric.unit}</small>}</strong>{metric.comparison && <small className={`bridge-kpi-delta ${metric.trend ?? 'neutral'}`}>{metric.comparison}</small>}{metric.period && <small className="bridge-kpi-period">{metric.period}</small>}</article>)}</section>
}

export function WorkspaceGrid({ main, rail }: { main: ReactNode; rail: ReactNode }) {
  return <div className="module-workspace"><section className="module-main-panel">{main}</section><aside className="module-rail">{rail}</aside></div>
}

export function OperationalFeed({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return <section className="module-main-panel"><header className="module-panel-header"><h2>{title}</h2>{href && <a href={href}>Ver todos →</a>}</header><div className="module-list">{children}</div></section>
}

export function OperationalRow({ status, title, summary, meta, href, action }: { status: string; title: string; summary?: string; meta?: string; href?: string; action?: ReactNode }) {
  const content = <><span className="source-status">{status}</span><strong>{title}</strong>{summary && <span>{summary}</span>}{meta && <small>{meta}</small>}{action}</>
  return href ? <a href={href}>{content}</a> : <article>{content}</article>
}

export function ProvenanceBadge({ provider, source }: { provider: string; source?: string }) {
  return <span className="source-status ready" title={source}>{provider}{source ? ` · ${source}` : ''}</span>
}

export function FreshnessLabel({ timestamp, source = 'servidor' }: { timestamp?: string | null; source?: string }) {
  return <small className="module-meta">{timestamp ? `Atualizado ${new Date(timestamp).toLocaleString('pt-BR')} · ${source}` : `Sem atualização registrada · ${source}`}</small>
}

export function BlockedState({ title, reason, action }: { title: string; reason: string; action?: ReactNode }) {
  return <section className="state error" role="status"><strong>{title}</strong><p>{reason}</p>{action}</section>
}

export function ModuleSubnav({ items, current }: { items: Array<{ label: string; href: string }>; current?: string }) {
  return <nav className="bridge-tabs" aria-label="Seções do módulo">{items.map((item) => <a href={item.href} aria-current={current === item.href ? 'page' : undefined} key={item.href}>{item.label}</a>)}</nav>
}
