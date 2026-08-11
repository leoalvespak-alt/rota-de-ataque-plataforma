import { createDatabase } from '@plataforma/db'
import { KanbanBoard, PageHeader, RoleBadge } from '@plataforma/ui-bridge'

export const dynamic = 'force-dynamic'
export default async function PublishingPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const publications = (await pool.query<{ id: string; thesis: string; scheduled_for: Date; status: string; ig_media_id: string | null }>(
      `SELECT publication.id, opportunity.thesis, publication.scheduled_for, publication.status, publication.ig_media_id
       FROM scheduled_publications publication JOIN content_opportunities opportunity ON opportunity.id = publication.content_opportunity_id
       ORDER BY publication.scheduled_for DESC LIMIT 100`,
    )).rows
    const statuses = ['draft', 'scheduled', 'publishing', 'published', 'failed']
    return <div className="page"><PageHeader title="Publicação e agendamento" subtitle="Criativos, calendário editorial e entrega pela Meta Graph API" actions={<button>+ Agendar novo</button>} />
      <section className="card" aria-label="Próximas publicações">{publications.slice(0, 7).map((publication) => <p key={publication.id}><strong>{publication.thesis}</strong> · {publication.scheduled_for?.toLocaleString('pt-BR') ?? 'Sem horário'}</p>)}</section>
      <KanbanBoard columns={statuses.map((status) => ({ title: status, items: publications.filter((publication) => publication.status === status).map((publication) => <article className="card" key={publication.id}><strong>{publication.thesis}</strong><p>{publication.scheduled_for?.toLocaleString('pt-BR') ?? 'Sem horário'}</p><RoleBadge role="actor" />{publication.ig_media_id && <small>Meta ID: {publication.ig_media_id}</small>}</article>) }))} />
    </div>
  } finally { await pool.end() }
}
