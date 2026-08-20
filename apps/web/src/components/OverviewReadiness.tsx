import Link from 'next/link'
import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { EmptyState, PriorityChip } from '@plataforma/ui-bridge'

type Recommendation = { key:string; priority:'P0'|'P1'|'P2'; title:string; detail:string; href:string }

/** Evidence-backed next actions. Empty campaigns get an activation checklist instead of decorative zeroes. */
export async function OverviewReadiness() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    if (!selected) return <EmptyState message="Selecione uma campanha para ver os pré-requisitos operacionais." />
    const [workers, sources, opportunities, contents, accounts] = await Promise.all([
      pool.query<{worker_name:string;enabled:boolean}>(`SELECT worker_name, enabled FROM worker_settings WHERE worker_name IN ('data-quality','news-radar','reddit-intelligence','competitive-intel','content-opportunity')`),
      pool.query<{count:number}>(`SELECT count(*)::int count FROM news_sources WHERE active=true`),
      pool.query<{count:number}>(`SELECT count(*)::int count FROM content_opportunities WHERE campaign_id=$1 AND status IN ('new','pending','review')`,[selected.id]),
      pool.query<{count:number}>(`SELECT count(*)::int count FROM content_items WHERE campaign_id=$1 AND status IN ('draft','approved','producing')`,[selected.id]),
      pool.query<{count:number}>(`SELECT count(*)::int count FROM accounts WHERE role='actor' AND status='healthy'`),
    ])
    const enabled = new Set(workers.rows.filter(row=>row.enabled).map(row=>row.worker_name))
    const recommendations:Recommendation[]=[]
    if(!enabled.has('data-quality')) recommendations.push({key:'data-quality',priority:'P0',title:'Ative a qualidade de dados',detail:'Os agregados do Overview serão atualizados pelo worker de qualidade e deixarão de depender de valores vazios.',href:'/automations'})
    if(!sources.rows[0]?.count) recommendations.push({key:'news-source',priority:'P1',title:'Cadastre uma fonte de notícias',detail:'O radar ainda não tem uma fonte ativa para a primeira coleta.',href:'/radar'})
    else if(!enabled.has('news-radar')) recommendations.push({key:'news-worker',priority:'P1',title:'Inicie o Radar de notícias',detail:'Há fonte ativa, mas o worker responsável está pausado.',href:'/automations'})
    if(!accounts.rows[0]?.count) recommendations.push({key:'actor',priority:'P1',title:'Vincule uma conta de publicação',detail:'Nenhuma conta ator saudável está disponível para validar agendamentos.',href:'/accounts'})
    if(opportunities.rows[0]?.count) recommendations.push({key:'opportunities',priority:'P1',title:`Revise ${opportunities.rows[0].count} oportunidade(s)`,detail:'Há sinais aguardando decisão editorial.',href:'/content-opportunity'})
    if(contents.rows[0]?.count) recommendations.push({key:'contents',priority:'P2',title:`Complete ${contents.rows[0].count} conteúdo(s)`,detail:'Existem rascunhos ou itens em produção que podem seguir para variante, revisão e calendário.',href:'/content-items'})
    return <section className="card" aria-label="Próximas ações" style={{marginBottom:'var(--space-4)'}}><header className="action-heading"><div><h2>Próximas ações</h2><p>Recomendações calculadas a partir da campanha ativa e do estado persistido.</p></div></header>{recommendations.length?<div className="record-list">{recommendations.map(item=><div key={item.key}><span><PriorityChip priority={item.priority}/></span><strong>{item.title}</strong><small>{item.detail}</small><Link href={item.href}>Abrir ação</Link></div>)}</div>:<EmptyState message="A campanha está pronta para operar. Acompanhe o Radar e a fila editorial para novas decisões." />}</section>
  } catch {
    return <EmptyState message="Não foi possível carregar o painel de próximas ações." />
  }
}
