import Link from 'next/link'
import { createDatabase } from '@plataforma/db'
import { ModulePage } from '@/components/ModulePage'
import RadarView from '../radar/view'
import MarketRadarView from '../market-radar/view'
import CompetitiveIntelView from '../competitive-intel/view'
import CommunityView from '../community/view'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function IntelligencePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const tab = typeof params.aba === 'string' ? params.aba : null
  if (tab) {
    const props = { searchParams: Promise.resolve(params) as never }
    const content = tab === 'mercado' ? <MarketRadarView /> : tab === 'concorrentes' ? <CompetitiveIntelView {...props} /> : tab === 'comunidades' ? <CommunityView {...props} /> : <RadarView {...props} />
    return <>{content}</>
  }

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const counts = (await pool.query<{ new_signals: number; market: number; observations: number; evidence: number }>(`SELECT
    (SELECT count(*)::int FROM radar_findings WHERE NOT processed AND created_at >= now()-interval '7 days') new_signals,
    (SELECT count(*)::int FROM market_signals WHERE last_seen_at >= now()-interval '7 days') market,
    (SELECT count(*)::int FROM provider_observations WHERE observed_at >= now()-interval '7 days') observations,
    (SELECT count(*)::int FROM organic_intelligence_signals WHERE created_at >= now()-interval '7 days') evidence`)).rows[0] ?? { new_signals: 0, market: 0, observations: 0, evidence: 0 }
  const recent = (await pool.query<{ id: string; title: string; source_name: string | null; relevance_score: number | null; created_at: string }>(`SELECT id,title,source_name,relevance_score::float,created_at::text FROM radar_findings ORDER BY relevance_score DESC NULLS LAST,created_at DESC LIMIT 8`)).rows
  return <ModulePage eyebrow="Sinais e contexto" title="Inteligência" subtitle="Radar, mercado, concorrentes e comunidades como fontes do mesmo fluxo de decisão." metrics={[{ label: 'Sinais novos', value: counts.new_signals, period: 'últimos 7 dias', sourceStatus: 'ready', href: '/inteligencia/radar' }, { label: 'Sinais de mercado', value: counts.market, period: 'últimos 7 dias', sourceStatus: 'ready', href: '/inteligencia/mercado' }, { label: 'Observações', value: counts.observations, period: 'últimos 7 dias', sourceStatus: 'ready' }, { label: 'Evidências processadas', value: counts.evidence, period: 'últimos 7 dias', sourceStatus: 'ready' }]} navigation={[{ label: 'Visão geral', href: '/inteligencia' }, { label: 'Radar', href: '/inteligencia/radar' }, { label: 'Mercado', href: '/inteligencia/mercado' }, { label: 'Concorrentes', href: '/inteligencia/concorrentes' }, { label: 'Comunidades', href: '/inteligencia/comunidades' }]} main={<><header className="module-panel-header"><div><p className="module-eyebrow">Feed de sinais</p><h2>O que mudou</h2></div><Link href="/inteligencia/radar">Abrir radar →</Link></header><div className="module-list">{recent.length ? recent.map((row) => <Link href={`/inteligencia/radar?selected=${row.id}`} key={row.id}><span className="source-status">{row.source_name ?? 'fonte não informada'}</span><strong>{row.title}</strong><span>{row.relevance_score === null ? 'Relevância não medida' : `Relevância ${Math.round(row.relevance_score * 100)}%`} · {new Date(row.created_at).toLocaleString('pt-BR')}</span></Link>) : <article>Nenhum sinal encontrado na janela atual.</article>}</div></>} rail={<><section><p className="module-eyebrow">Cobertura</p><h2>Quatro fontes</h2><p>Radar, mercado, concorrentes e comunidades preservam provider, evidência, confiança e freshness.</p></section><section><p className="module-eyebrow">Ações</p><h2>Enviar para</h2><p><Link href="/decisoes">Fila de decisões</Link></p><p><Link href="/planejamento/oportunidades">Criar oportunidade</Link></p><p><Link href="/sistema">Saúde de coleta</Link></p></section></>} />
}

