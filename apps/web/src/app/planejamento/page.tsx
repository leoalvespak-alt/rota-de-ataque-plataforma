import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import { createDatabase } from '@plataforma/db'
import { ModulePage } from '@/components/ModulePage'
import { FunnelBoard } from '../conteudo/FunnelBoard'

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const tab = typeof params.aba === 'string' ? params.aba : null
  const legacyTabs: Record<string, string> = { funil: '/planejamento/funil', oportunidades: '/planejamento/oportunidades', conteudos: '/planejamento/conteudos', teses: '/planejamento/teses', ponte: '/planejamento/ativos', calendario: '/planejamento/calendario', aprovacao: '/planejamento/aprovacoes', comprovantes: '/planejamento/comprovantes' }
  if (tab && legacyTabs[tab]) permanentRedirect(legacyTabs[tab])
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const counts = (await pool.query<{ suggestions: number; opportunities: number; items: number; variants: number; publications: number }>(`SELECT
    (SELECT count(*)::int FROM content_suggestions WHERE curation_status IN ('proposed','approved')) suggestions,
    (SELECT count(*)::int FROM content_opportunities WHERE status NOT IN ('rejected','archived')) opportunities,
    (SELECT count(*)::int FROM content_items WHERE status NOT IN ('archived','rejected')) items,
    (SELECT count(*)::int FROM content_variants WHERE status NOT IN ('rejected','archived')) variants,
    (SELECT count(*)::int FROM scheduled_publications_compat WHERE status IN ('approved','scheduled','planned')) publications`)).rows[0] ?? { suggestions: 0, opportunities: 0, items: 0, variants: 0, publications: 0 }
  return <ModulePage eyebrow="Operação editorial" title="Planejamento" subtitle="Conecte pauta, conteúdo, ativo, aprovação e publicação no mesmo fluxo." metrics={[{ label: 'Sugestões', value: counts.suggestions, period: 'estado atual', sourceStatus: 'ready', href: '/planejamento/oportunidades' }, { label: 'Oportunidades', value: counts.opportunities, period: 'estado atual', sourceStatus: 'ready', href: '/planejamento/oportunidades' }, { label: 'Conteúdos', value: counts.items, period: 'estado atual', sourceStatus: 'ready', href: '/planejamento/conteudos' }, { label: 'Publicações', value: counts.publications, period: 'aprovadas/agendadas', sourceStatus: 'ready', href: '/planejamento/calendario' }]} navigation={[{ label: 'Visão geral', href: '/planejamento' }, { label: 'Funil', href: '/planejamento/funil' }, { label: 'Calendário', href: '/planejamento/calendario' }, { label: 'Ativos', href: '/planejamento/ativos' }]} main={<><header className="module-panel-header"><div><p className="module-eyebrow">Próximo vínculo</p><h2>Fluxo editorial</h2></div><Link href="/planejamento/funil">Abrir funil →</Link></header><div className="module-list"><Link href="/planejamento/oportunidades"><strong>Oportunidades</strong><span>{counts.opportunities} pautas esperando decisão ou produção.</span></Link><Link href="/planejamento/conteudos"><strong>Conteúdos</strong><span>{counts.items} itens editoriais com variantes e ciclo de vida.</span></Link><Link href="/planejamento/ativos"><strong>Ativos e ponte criativa</strong><span>Vincule mídia aprovada sem sair do planejamento.</span></Link></div><FunnelBoard /></>} rail={<><section><p className="module-eyebrow">Blueprint</p><h2>Uma cadeia rastreável</h2><p>Ideia → conteúdo → ativo → aprovação → publicação. Cada etapa mantém origem, estado e próxima ação.</p></section><section><p className="module-eyebrow">Acessos</p><h2>Operação</h2><p><Link href="/planejamento/teses">Teses editoriais</Link></p><p><Link href="/planejamento/aprovacoes">Aprovações</Link></p><p><Link href="/planejamento/comprovantes">Comprovantes</Link></p></section></>} />
}
