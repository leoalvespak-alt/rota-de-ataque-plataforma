import { createDatabase } from '@plataforma/db'
import { EmptyState } from '@plataforma/ui-bridge'
import { getCampaignContext } from '@/lib/campaign-context'
import { ItemDetailClient } from './ItemDetailClient'

export default async function ContentItemDetail({params}:{params:Promise<{id:string}>}) {
  const { id } = await params
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const item = (await pool.query<{id:string;hook:string;angle:string;status:string;brand_voice_version:string}>(`SELECT id,hook,angle,status,brand_voice_version FROM content_items WHERE id=$1 AND ($2::uuid IS NULL OR campaign_id=$2)`, [id,selected?.id??null])).rows[0]
    if (!item) return <main className="page"><EmptyState message="Content item não encontrado."/></main>
    const variants = (await pool.query<{id:string;channel:'instagram'|'threads'|'email'|'whatsapp_dm'|'whatsapp_group';status:string;payload:Record<string,unknown>,impressions:number,engagements:number,conversions:number}>(`SELECT variant.id,variant.channel,variant.status,variant.payload,COALESCE(performance.impressions,0) impressions,COALESCE(performance.engagements,0) engagements,COALESCE(performance.conversions,0) conversions FROM content_variants variant LEFT JOIN content_performance performance ON performance.variant_id=variant.id WHERE variant.content_item_id=$1 ORDER BY variant.channel`, [id])).rows
    const events = (await pool.query<{id:string;channel:'instagram'|'threads'|'email'|'whatsapp_dm'|'whatsapp_group';event_type:string;at:Date}>(`SELECT id::text,channel,event_type,at FROM timeline_events WHERE content_item_id=$1 ORDER BY at DESC LIMIT 30`, [id])).rows
    const assets = (await pool.query<{id:string;variant_id:string|null;storage_ref:string;filename:string|null;mime_type:string|null;width:number|null;height:number|null;status:string;source:string;created_at:Date}>(`SELECT id,variant_id,storage_ref,filename,mime_type,width,height,status,source,created_at FROM content_assets WHERE content_item_id=$1 ORDER BY created_at DESC`, [id])).rows
    
    return <ItemDetailClient item={item} variants={variants} assets={assets.map(asset => ({...asset, created_at:asset.created_at.toISOString()}))} events={events.map(e => ({...e, at: e.at.toISOString()}))} />
  } finally {}
}
