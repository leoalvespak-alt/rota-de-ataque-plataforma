import Link from 'next/link'
import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { EmptyState, PriorityChip } from '@plataforma/ui-bridge'

type Recommendation = { key: string; priority: 'P0'|'P1'|'P2'; title: string; detail: string; href: string }

export async function OverviewReadiness() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    if (!selected) return <EmptyState message="Selecione uma campanha para ver os pré-requisitos editoriais." />
    const [workers, sources, opportunities, contents] = await Promise.all([
      pool.query<{ worker_name: string; enabled: boolean }>('SELECT worker_name, enabled FROM worker_settings WHERE worker_name IN (\'news-radar\',\'content-opportunity\',\'content-item-orchestrator\')'),
      pool.query<{ count: number }>('SELECT count(*)::int count FROM news_sources WHERE active=true'),
      pool.query<{ count: number }>('SELECT count(*)::int count FROM content_opportunities WHERE campaign_id=$1 AND status IN (\'new\',\'pending\',\'review\')', [selected.id]),
      pool.query<{ count: number }>('SELECT count(*)::int count FROM content_items WHERE campaign_id=$1 AND status IN (\'draft\',\'approved\',\'producing\')', [selected.id]),
    ])
    const enabled = new Set(workers.rows.filter((row) => row.enabled).map((row) => row.worker_name))
    const recommendations: Recommendation[] = []
    if (!sources.rows[0]?.count) recommendations.push({ key: 'news-source', priority: 'P1', title: 'Cadastre uma fonte de notícias', detail: 'O radar ainda não tem uma fonte ativa para a primeira coleta.', href: '/radar' })
    else if (!enabled.has('news-radar')) recommendations.push({ key: 'news-worker', priority: 'P1', title: 'Inicie o Radar de notícias', detail: 'Há fonte ativa, mas o worker responsável está pausado.', href: '/sistema/saude' })
    if (opportunities.rows[0]?.count) recommendations.push({ key: 'opportunities', priority: 'P1', title: 'Revise ' + opportunities.rows[0].count + ' oportunidade(s)', detail: 'Há sinais aguardando decisão editorial.', href: '/content-opportunity' })
    if (contents.rows[0]?.count) recommendations.push({ key: 'contents', priority: 'P2', title: 'Complete ' + contents.rows[0].count + ' conteúdo(s)', detail: 'Existem itens que podem seguir para revisão e calendário.', href: '/content-items' })
    return <section className="card" aria-label="Próximas ações" style={{ marginBottom: 'var(--space-4)' }}><header className="action-heading"><div><h2>Próximas ações</h2><p>Recomendações calculadas a partir da campanha ativa e do estado persistido.</p></div></header>{recommendations.length ? <div className="record-list">{recommendations.map((item) => <div key={item.key}><span><PriorityChip priority={item.priority} /></span><strong>{item.title}</strong><small>{item.detail}</small><Link href={item.href}>Abrir ação</Link></div>)}</div> : <EmptyState message="A campanha está pronta para operar. Acompanhe o Radar e o fluxo editorial." />}</section>
  } catch {
    return <EmptyState message="Não foi possível carregar o painel de próximas ações." />
  } finally {
    await pool.end()
  }
}
