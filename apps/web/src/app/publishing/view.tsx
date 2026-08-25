import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { PublishingClient } from './PublishingClient'

export default async function PublishingPage({ section = 'calendario' }: { section?: 'calendario' | 'aprovacao' | 'comprovantes' }) {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const publications = (await pool.query(
      `SELECT scheduled.id,COALESCE(scheduled.title,item.hook,opportunity.thesis) title,scheduled.caption,scheduled.scheduled_for,scheduled.status,scheduled.channel,
        scheduled.origin,scheduled.locked_at,scheduled.subtype,scheduled.hashtags,scheduled.cta,scheduled.thesis_id,scheduled.pillar,scheduled.format,
        scheduled.content_structure,scheduled.ig_media_id external_id
       FROM scheduled_publications scheduled
       LEFT JOIN content_opportunities opportunity ON opportunity.id=scheduled.content_opportunity_id
       LEFT JOIN content_variants variant ON variant.id=scheduled.variant_id
       LEFT JOIN content_items item ON item.id=variant.content_item_id
       WHERE ($1::uuid IS NULL OR COALESCE(scheduled.campaign_id,opportunity.campaign_id)=$1)
       ORDER BY scheduled.scheduled_for DESC NULLS LAST LIMIT 500`, [selected?.id ?? null],
    )).rows

    const [pillars, formats] = await Promise.all([
      pool.query("SELECT name, slug FROM content_pillars WHERE active = true ORDER BY weekly_weight DESC"),
      pool.query("SELECT format_name, slug FROM format_playbook WHERE active = true ORDER BY frequency_max DESC"),
    ])

    const scheduled = publications.filter((item: any) => item.status === 'scheduled').length
    const published = publications.filter((item: any) => item.status === 'published').length
    const failed = publications.filter((item: any) => item.status === 'failed').length

    return (
      <PublishingClient
        publications={JSON.parse(JSON.stringify(publications))}
        scheduled={scheduled}
        published={published}
        failed={failed}
        pillars={pillars.rows}
        formats={formats.rows}
        section={section}
      />
    )
  } finally {}
}
