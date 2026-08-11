import { createDatabase } from '@plataforma/db'
import { ChannelTimeline, EmptyState, PageHeader, ThreePaneLayout, VariantPreview } from '@plataforma/ui-bridge'
import { ContentItemActions } from './ContentItemActions'

export const dynamic = 'force-dynamic'
export default async function ContentItemDetail({params}:{params:Promise<{id:string}>}) {
  const { id } = await params
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const item = (await pool.query<{id:string;hook:string;angle:string;status:string;brand_voice_version:string}>(`SELECT id,hook,angle,status,brand_voice_version FROM content_items WHERE id=$1`, [id])).rows[0]
    if (!item) return <main className="page"><EmptyState message="Content item não encontrado."/></main>
    const variants = (await pool.query<{id:string;channel:'instagram'|'threads'|'email'|'whatsapp_dm'|'whatsapp_group';status:string;payload:Record<string,unknown>}>(`SELECT id,channel,status,payload FROM content_variants WHERE content_item_id=$1 ORDER BY channel`, [id])).rows
    const events = (await pool.query<{id:string;channel:'instagram'|'threads'|'email'|'whatsapp_dm'|'whatsapp_group';event_type:string;at:Date}>(`SELECT id::text,channel,event_type,at FROM timeline_events WHERE content_item_id=$1 ORDER BY at DESC LIMIT 30`, [id])).rows
    return <main className="page">
      <PageHeader title={item.hook} subtitle={`${item.angle} · voz ${item.brand_voice_version}`}/>
      <ContentItemActions id={item.id} status={item.status}/>
      <ThreePaneLayout list={<section><h2>Canônico</h2><p>Status: {item.status}</p><p>Antes de aprovar: tese ativa, voz definida e ao menos uma variante pronta.</p></section>} detail={<section><h2>Previews por canal</h2>{variants.map((variant)=><VariantPreview key={variant.id} channel={variant.channel} status={variant.status} text={String(variant.payload.text ?? variant.payload.subject ?? JSON.stringify(variant.payload))}/>)}</section>} context={<section><h2>Publicações</h2><ChannelTimeline events={events.map((event)=>({id:event.id,channel:event.channel,event:event.event_type,at:event.at.toISOString()}))}/></section>}/>
    </main>
  } finally { await pool.end() }
}
