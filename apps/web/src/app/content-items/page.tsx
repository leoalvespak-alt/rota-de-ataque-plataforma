import { createDatabase } from '@plataforma/db'
import { ContentItemCard, EmptyState, PageHeader, SavedViewTabs } from '@plataforma/ui-bridge'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export default async function ContentItemsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const items = (await pool.query<{id:string;hook:string;status:string;channels:string[]}>(`SELECT item.id,item.hook,item.status,COALESCE(array_agg(DISTINCT variant.channel) FILTER(WHERE variant.channel IS NOT NULL),'{}') channels FROM content_items item LEFT JOIN content_variants variant ON variant.content_item_id=item.id GROUP BY item.id ORDER BY item.created_at DESC LIMIT 100`)).rows
    return <main className="page"><PageHeader title="Content items" subtitle="Briefing canônico, variantes por canal e publicação rastreável"/><SavedViewTabs views={['draft','approved','producing','published','archived']} active="draft"/>{items.length ? <section className="feature-grid">{items.map((item)=><Link href={`/content-items/${item.id}`} key={item.id}><ContentItemCard title={item.hook} status={item.status} channels={item.channels as never}/></Link>)}</section> : <EmptyState message="Nenhum content item ainda. Crie um a partir de uma oportunidade aprovada."/>}</main>
  } finally { await pool.end() }
}
