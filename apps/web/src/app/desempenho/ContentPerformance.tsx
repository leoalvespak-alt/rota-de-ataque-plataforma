import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'

export async function ContentPerformance() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const { selected } = await getCampaignContext(pool)
  const result = await pool.query(`SELECT COALESCE(thesis.title,'Sem tese') thesis,count(DISTINCT item.id)::int contents,COALESCE(sum(performance.impressions),0)::int impressions,COALESCE(sum(performance.engagements),0)::int engagements,COALESCE(sum(performance.conversions),0)::int conversions FROM content_items item LEFT JOIN theses thesis ON thesis.id=item.thesis_id LEFT JOIN content_variants variant ON variant.content_item_id=item.id LEFT JOIN content_performance performance ON performance.variant_id=variant.id WHERE ($1::uuid IS NULL OR item.campaign_id=$1) GROUP BY thesis.title ORDER BY conversions DESC,engagements DESC`, [selected?.id ?? null])
  return <section className="bridge-section"><h2>Desempenho por tese</h2><div style={{ overflowX: 'auto' }}><table><thead><tr><th>Tese</th><th>Conteúdos</th><th>Impressões</th><th>Engajamentos</th><th>Conversões</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.thesis}><td>{row.thesis}</td><td>{row.contents}</td><td>{row.impressions}</td><td>{row.engagements}</td><td>{row.conversions}</td></tr>)}</tbody></table></div></section>
}
