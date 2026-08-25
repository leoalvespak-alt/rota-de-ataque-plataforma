import Link from 'next/link'
import { createDatabase } from '@plataforma/db'
import { ModulePage } from '@/components/ModulePage'
import ReviewInboxView from '../review-inbox/view'
import EngagementView from '../engagement-queue/view'

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const tab = typeof params.aba === 'string' ? params.aba : null
  if (tab) return <>{tab === 'engajamento' ? <EngagementView /> : <ReviewInboxView />}</>
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const counts = (await pool.query<{ review: number; radar: number; insights: number; suggestions: number; engagement: number }>(`SELECT
    (SELECT count(*)::int FROM review_inbox WHERE status='pending') review,
    (SELECT count(*)::int FROM radar_findings WHERE NOT processed) radar,
    (SELECT count(*)::int FROM competitor_insights WHERE NOT processed) insights,
    (SELECT count(*)::int FROM content_suggestions WHERE curation_status='proposed') suggestions,
    (SELECT count(*)::int FROM engagement_actions WHERE status IN ('pending','awaiting_approval')) engagement`)).rows[0] ?? { review: 0, radar: 0, insights: 0, suggestions: 0, engagement: 0 }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  return <ModulePage eyebrow="Fila humana" title="Decisões" subtitle="Uma fila única para revisar sinais, sugestões, insights e ações de relacionamento." metrics={[{ label: 'Pendências', value: total, period: 'agora', sourceStatus: 'ready' }, { label: 'Revisão', value: counts.review, period: 'fila humana', sourceStatus: 'ready', href: '/decisoes/revisao' }, { label: 'Radar e insights', value: counts.radar + counts.insights, period: 'não processados', sourceStatus: 'ready' }, { label: 'Engajamento', value: counts.engagement, period: 'aguardando aprovação', sourceStatus: 'ready', href: '/decisoes/engajamento' }]} navigation={[{ label: 'Todas', href: '/decisoes' }, { label: 'Revisão', href: '/decisoes/revisao' }, { label: 'Engajamento', href: '/decisoes/engajamento' }]} main={<><header className="module-panel-header"><div><p className="module-eyebrow">Saved views</p><h2>Fila por origem</h2></div><Link href="/decisoes/revisao">Abrir próxima decisão →</Link></header><div className="module-list"><Link href="/decisoes/revisao"><strong>Revisão humana</strong><span>{counts.review} itens aguardando avaliação.</span></Link><Link href="/decisoes?view=radar"><strong>Radar</strong><span>{counts.radar} achados ainda não processados.</span></Link><Link href="/decisoes?view=insights"><strong>Insights</strong><span>{counts.insights} insights ainda não processados.</span></Link><Link href="/planejamento/oportunidades"><strong>Sugestões editoriais</strong><span>{counts.suggestions} sugestões propostas.</span></Link><Link href="/decisoes/engajamento"><strong>Engajamento</strong><span>{counts.engagement} ações aguardam aprovação ou execução.</span></Link></div></>} rail={<><section><p className="module-eyebrow">Contexto</p><h2>Inspector</h2><p>Seleção, evidência, recomendação, confiança e auditoria ficam no detalhe do item.</p></section><section><p className="module-eyebrow">Atalhos</p><h2>Produtividade</h2><p>Use J/K para navegar e mantenha ações críticas disponíveis fora do hover.</p></section></>} />
}

