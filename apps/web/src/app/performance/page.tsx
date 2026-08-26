import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { ModulePage } from '@/components/ModulePage'

async function count(pool: { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> }, sql: string, values: unknown[]) { try { return Number((await pool.query<{ value: number }>(sql, values)).rows[0]?.value ?? 0) } catch { return null } }

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const tab = typeof params.aba === 'string' ? params.aba : null
  const legacyTabs: Record<string, string> = { roi: '/performance/roi', orcamento: '/performance/orcamento', conteudo: '/performance/conteudo' }
  if (tab && legacyTabs[tab]) permanentRedirect(legacyTabs[tab])
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const { selected } = await getCampaignContext(pool)
  const campaignId = selected?.id ?? null
  const [conversions, usage, content, people] = await Promise.all([
    count(pool, `SELECT count(*)::int value FROM conversion_events WHERE ($1::uuid IS NULL OR campaign_id=$1)`, [campaignId]),
    count(pool, `SELECT count(*)::int value FROM provider_usage WHERE recorded_at >= now()-interval '30 days'`, []),
    count(pool, `SELECT count(*)::int value FROM content_items WHERE created_at >= now()-interval '30 days' AND ($1::uuid IS NULL OR campaign_id=$1)`, [campaignId]),
    count(pool, `SELECT count(*)::int value FROM leads lead JOIN lead_scores score ON score.lead_id=lead.id WHERE lead.merged_into IS NULL AND ($1::uuid IS NULL OR score.campaign_id=$1)`, [campaignId]),
  ])
  return <ModulePage eyebrow="Análise e atribuição" title="Performance" subtitle="Retorno, conteúdo, providers e relacionamento com período, denominador e fonte explícitos." metrics={[{ label: 'Conversões', value: conversions ?? 'Não medido', period: 'janela disponível', sourceStatus: conversions === null ? 'not_measured' : 'ready', href: '/performance/roi' }, { label: 'Uso de providers', value: usage ?? 'Não medido', period: 'últimos 30 dias', sourceStatus: usage === null ? 'not_measured' : 'ready', href: '/performance/orcamento' }, { label: 'Conteúdos', value: content ?? 'Não medido', period: 'últimos 30 dias', sourceStatus: content === null ? 'not_measured' : 'ready', href: '/performance/conteudo' }, { label: 'Pessoas na base', value: people ?? 'Não medido', period: 'estado atual', sourceStatus: people === null ? 'not_measured' : 'ready', href: '/publico/pessoas' }]} navigation={[{ label: 'Visão geral', href: '/performance' }, { label: 'Atribuição', href: '/performance/roi' }, { label: 'Orçamento', href: '/performance/orcamento' }, { label: 'Conteúdo', href: '/performance/conteudo' }]} main={<><header className="module-panel-header"><div><p className="module-eyebrow">Leitura comparável</p><h2>Resultado versus custo</h2></div><Link href="/performance/roi">Abrir atribuição →</Link></header><div className="module-list"><Link href="/performance/roi"><strong>Atribuição por origem</strong><span>Breakdown de fonte e canal com evidência para drill-down.</span></Link><Link href="/performance/orcamento"><strong>Orçamento</strong><span>Reservado, consumido e restante; ausência de teto é bloqueio.</span></Link><Link href="/performance/conteudo"><strong>Conteúdo</strong><span>Ranking só quando a janela e a amostra são comparáveis.</span></Link></div></>} rail={<><section><p className="module-eyebrow">Semântica</p><h2>Zero ≠ sem dados</h2><p>Valores não medidos e ausência de orçamento não são convertidos artificialmente em zero.</p></section><section><p className="module-eyebrow">Exportação</p><h2>Dados rastreáveis</h2><p>Use as visões detalhadas para exportar o breakdown correspondente ao período.</p></section></>} />
}
