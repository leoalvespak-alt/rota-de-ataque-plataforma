import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { PublishingClient } from './PublishingClient'

export default async function PublishingPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const publications = (await pool.query<{id:string;title:string;scheduled_for:Date|null;status:string;channel:'instagram'|'threads'|'email'|'whatsapp_dm'|'whatsapp_group';external_id:string|null}>(`SELECT publication.id,item.hook title,publication.published_at scheduled_for,variant.status,publication.channel,publication.external_id FROM content_publications publication JOIN content_variants variant ON variant.id=publication.variant_id JOIN content_items item ON item.id=variant.content_item_id WHERE ($1::uuid IS NULL OR item.campaign_id=$1) UNION ALL SELECT scheduled.id,opportunity.thesis,scheduled.scheduled_for,scheduled.status,'instagram',scheduled.ig_media_id FROM scheduled_publications scheduled JOIN content_opportunities opportunity ON opportunity.id=scheduled.content_opportunity_id WHERE ($1::uuid IS NULL OR opportunity.campaign_id=$1) ORDER BY scheduled_for DESC NULLS LAST LIMIT 250`, [selected?.id??null])).rows
    
    const scheduled = publications.filter(item => item.status === 'scheduled').length
    const published = publications.filter(item => item.status === 'published').length
    const failed = publications.filter(item => item.status === 'failed').length
    
    return <PublishingClient publications={publications} scheduled={scheduled} published={published} failed={failed} />
  } finally {
    await pool.end()
  }
}
