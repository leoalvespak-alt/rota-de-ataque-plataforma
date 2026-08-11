import { createDatabase } from '@plataforma/db'
import { ContentItemCard, EmptyState, PageHeader } from '@plataforma/ui-bridge'

export const dynamic = 'force-dynamic'
export default async function ThesesPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const theses = (await pool.query<{id:string;title:string;description:string;active:boolean;count:string}>(`SELECT thesis.id,thesis.title,thesis.description,thesis.active,count(item.id)::text count FROM theses thesis LEFT JOIN content_items item ON item.thesis_id=thesis.id GROUP BY thesis.id ORDER BY thesis.active DESC,thesis.title LIMIT 7`)).rows
    return <main className="page"><PageHeader title="Teses" subtitle="Até sete teses ativas por campanha, com impacto rastreável em conteúdo."/><section className="feature-grid">{theses.map((thesis)=><ContentItemCard key={thesis.id} title={thesis.title} status={`${thesis.active?'ativa':'inativa'} · ${thesis.count} items`}/>) }{theses.length < 7 && <EmptyState message="Slot livre para nova tese ativa."/>}</section></main>
  } finally { await pool.end() }
}
