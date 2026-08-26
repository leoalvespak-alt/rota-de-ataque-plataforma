import type { ReactNode } from 'react'
import Link from 'next/link'
import { ModuleSubnav } from './ModuleSubnav'

export { ModuleSubnav } from './ModuleSubnav'

export type MetricViewModel = {
  label: string
  value: string | number
  unit?: string
  period?: string
  comparison?: string
  trend?: 'up' | 'down' | 'neutral'
  sourceStatus?: 'ready' | 'degraded' | 'blocked' | 'not_measured'
  href?: string
  freshness?: string | null
}

export function ModuleHeader({ eyebrow, title, subtitle, context, actions }: { eyebrow: string; title: string; subtitle?: string; context?: string; actions?: ReactNode }) {
  return <header className="module-header bridge-page-header"><div className="module-header-title"><p className="module-eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}{context && <small className="module-meta">{context}</small>}</div>{actions && <div className="bridge-page-header-actions" aria-label="Ações da página">{actions}</div>}</header>
}

export function MetricStrip({ metrics }: { metrics: MetricViewModel[] }) {
  if (!metrics.length) return null
  const sourceLabel = (status: MetricViewModel['sourceStatus']) => status === 'ready' ? 'fonte pronta' : status === 'degraded' ? 'degradado' : status === 'blocked' ? 'bloqueado' : 'não medido'
  return <section className="bridge-kpi-row" aria-label="Métricas principais">{metrics.map((metric) => <article className="bridge-kpi-card bridge-kpi-card--module" key={metric.label}><div className="bridge-kpi-header"><span className="bridge-kpi-label">{metric.label}</span>{metric.sourceStatus && <span className={`source-status ${metric.sourceStatus}`}>{sourceLabel(metric.sourceStatus)}</span>}</div><strong className="bridge-kpi-value">{metric.href ? <Link href={metric.href}>{metric.value}</Link> : metric.value}{metric.unit && <small> {metric.unit}</small>}</strong>{metric.comparison && <small className={`bridge-kpi-delta ${metric.trend ?? 'neutral'}`}>{metric.comparison}</small>}{metric.period && <small className="bridge-kpi-period">{metric.period}</small>}{metric.freshness && <small className="bridge-source-freshness">{metric.freshness}</small>}</article>)}</section>
}

export function WorkspaceGrid({ main, rail }: { main: ReactNode; rail?: ReactNode }) {
  return <div className={`module-workspace${rail ? '' : ' module-workspace--single'}`}><section className="module-main-panel">{main}</section>{rail && <aside className="module-rail">{rail}</aside>}</div>
}

export function ActionCluster({ children }: { children: ReactNode }) {
  return <div className="bridge-action-cluster">{children}</div>
}

export function SectionHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="bridge-section-header"><div>{eyebrow && <p className="module-eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="bridge-section-actions">{actions}</div>}</header>
}

export function ChartPanel({ title, source, period, alternative, children }: { title: string; source?: string; period?: string; alternative?: string; children: ReactNode }) {
  return <section className="bridge-chart-panel"><SectionHeader title={title} description={[period, source].filter(Boolean).join(' · ')} />{children}<p className="bridge-chart-alternative">{alternative ?? 'A visualização usa somente a série entregue pela fonte.'}</p></section>
}

export function InspectorPanel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <aside className="bridge-inspector-panel"><SectionHeader title={title} actions={actions} /><div>{children}</div></aside>
}

export function AssetGallery({ children, empty }: { children?: ReactNode; empty?: ReactNode }) {
  return <section className="bridge-asset-gallery">{children ?? empty ?? <NotMeasuredState reason="Nenhum ativo foi entregue pela fonte atual." />}</section>
}

export function TimelineBoard({ children, empty }: { children?: ReactNode; empty?: ReactNode }) {
  return <section className="bridge-timeline-board">{children ?? empty ?? <NotMeasuredState reason="Nenhuma data foi entregue pela fonte atual." />}</section>
}

export function OperationalFeed({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return <section className="module-main-panel"><header className="module-panel-header"><h2>{title}</h2>{href && <a href={href}>Ver todos →</a>}</header><div className="module-list">{children}</div></section>
}

export function OperationalRow({ status, title, summary, meta, href, action }: { status: string; title: string; summary?: string; meta?: string; href?: string; action?: ReactNode }) {
  const content = <><span className="source-status">{status}</span><strong>{title}</strong>{summary && <span>{summary}</span>}{meta && <small>{meta}</small>}{action}</>
  return href ? <Link href={href}>{content}</Link> : <article>{content}</article>
}

export function ProvenanceBadge({ provider, source }: { provider: string; source?: string }) {
  return <span className="source-status ready" title={source}>{provider}{source ? ` · ${source}` : ''}</span>
}

export function FreshnessLabel({ timestamp, source = 'servidor' }: { timestamp?: string | null; source?: string }) {
  return <small className="module-meta">{timestamp ? `Atualizado ${new Date(timestamp).toLocaleString('pt-BR')} · ${source}` : `Sem atualização registrada · ${source}`}</small>
}

export function BlockedState({ title, reason, action }: { title: string; reason: string; action?: ReactNode }) {
  return <section className="state blocked" role="status"><strong>{title}</strong><p>{reason}</p>{action}</section>
}

export function DegradedState({ title, reason, action }: { title: string; reason: string; action?: ReactNode }) {
  return <section className="state degraded" role="status"><strong>{title}</strong><p>{reason}</p>{action}</section>
}

export function FilteredEmptyState({ message, reset }: { message: string; reset?: ReactNode }) {
  return <section className="state filtered-empty" role="status"><strong>Nenhum resultado nesta visão</strong><p>{message}</p>{reset}</section>
}

export function NotMeasuredState({ title = 'Ainda não medido', reason }: { title?: string; reason: string }) {
  return <section className="state not-measured" role="status"><strong>{title}</strong><p>{reason}</p></section>
}
