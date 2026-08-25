import Link from 'next/link'
import { createDatabase } from '@plataforma/db'
import { ModulePage } from '@/components/ModulePage'

export default async function AudienceSegmentsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const rows = (await pool.query<{ id: string; name: string; member_count: number }>(`SELECT community.id,community.name,count(membership.lead_id)::int member_count FROM communities community LEFT JOIN lead_community_membership membership ON membership.community_id=community.id GROUP BY community.id,community.name ORDER BY member_count DESC,community.name LIMIT 100`)).rows
  return <ModulePage eyebrow="Público" title="Segmentos" subtitle="Comunidades e clusters de audiência derivados de dados reais." metrics={[{ label: 'Segmentos', value: rows.length, period: 'cadastro atual', sourceStatus: 'ready' }]} navigation={[{ label: 'Público', href: '/publico' }, { label: 'Segmentos', href: '/publico/segmentos' }]} main={<><header className="module-panel-header"><h2>Segmentos ativos</h2><Link href="/publico/pessoas">Ver pessoas →</Link></header><div className="module-list">{rows.length ? rows.map((row) => <article key={row.id}><strong>{row.name}</strong><span>{row.member_count} pessoa(s) associada(s).</span></article>) : <article>Nenhum segmento cadastrado.</article>}</div></>} rail={<section><p className="module-eyebrow">Governança</p><h2>Origem e consentimento</h2><p>Segmentos não autorizam contato por si só. A elegibilidade vem da política do canal.</p></section>} />
}

