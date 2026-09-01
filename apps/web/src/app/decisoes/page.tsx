import { createDatabase } from '@plataforma/db'
import { ModulePage } from '@/components/ModulePage'
import Link from 'next/link'

export default async function DecisionsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const counts = (await pool.query<{ review: number; radar: number; suggestions: number }>(`SELECT
      (SELECT count(*)::int FROM review_inbox WHERE status='pending') review,
      (SELECT count(*)::int FROM radar_findings WHERE NOT processed) radar,
      (SELECT count(*)::int FROM content_suggestions WHERE curation_status='proposed') suggestions`)).rows[0] ?? { review: 0, radar: 0, suggestions: 0 }
    const total = counts.review + counts.radar + counts.suggestions
    return <ModulePage eyebrow="Fila humana" title="Decisões" subtitle="Uma fila editorial para revisar radar, oportunidades e conteúdo." metrics={[{ label: 'Pendências', value: total, period: 'agora', sourceStatus: 'ready' }, { label: 'Revisão', value: counts.review, period: 'fila humana', sourceStatus: 'ready', href: '/decisoes/revisao' }, { label: 'Radar', value: counts.radar, period: 'não processado', sourceStatus: 'ready', href: '/radar' }, { label: 'Sugestões', value: counts.suggestions, period: 'editoriais', sourceStatus: 'ready', href: '/planejamento/oportunidades' }]} navigation={[{ label: 'Todas', href: '/decisoes' }, { label: 'Revisão', href: '/decisoes/revisao' }]} main={<section className="card"><h2>Próximas decisões</h2><div className="module-list"><Link href="/decisoes/revisao"><strong>Revisão humana</strong><span>{counts.review} itens aguardando avaliação.</span></Link><Link href="/radar"><strong>Radar</strong><span>{counts.radar} achados ainda não processados.</span></Link><Link href="/planejamento/oportunidades"><strong>Oportunidades editoriais</strong><span>{counts.suggestions} sugestões propostas.</span></Link></div></section>} rail={<section><p className="module-eyebrow">Núcleo</p><h2>Editorial</h2><p>Execuções de relacionamento e outbound não fazem parte desta fase.</p></section>} />
  } finally {
    await pool.end()
  }
}
