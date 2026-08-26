import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { DataGrid, EmptyState, FreshnessLabel, KpiCard, KpiRow } from '@plataforma/ui-bridge'
import { DataPageControls } from '@/components/DataPageControls'
import { appPath } from '@/lib/base-path'
import { DATA_PAGE_SIZE, pageOffset, parseDataPageParams } from '@/lib/data-page'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
export interface ContentPerformanceRow { variantId: string; thesis: string; contentTitle: string; channel: string; format: string; impressions: number; engagements: number; clicks: number; conversions: number; computedAt: string }

export async function ContentPerformance({ searchParams }: { searchParams?: SearchParams } = {}) {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const { selected } = await getCampaignContext(pool)
  const params = parseDataPageParams(searchParams ? await searchParams : {})
  const values = [selected?.id ?? null, params.from, params.to, DATA_PAGE_SIZE + 1, pageOffset(params.page)]
  const result = await pool.query<ContentPerformanceRow>(`SELECT variant.id "variantId",COALESCE(thesis.title,'Sem tese') thesis,COALESCE(item.hook,'Sem título') "contentTitle",variant.channel,variant.format,
    performance.impressions,performance.engagements,performance.clicks,performance.conversions,performance.computed_at::text "computedAt"
    FROM content_performance performance JOIN content_variants variant ON variant.id=performance.variant_id JOIN content_items item ON item.id=variant.content_item_id
    LEFT JOIN theses thesis ON thesis.id=item.thesis_id WHERE ($1::uuid IS NULL OR item.campaign_id=$1) AND ($2::date IS NULL OR performance.computed_at >= $2::date) AND ($3::date IS NULL OR performance.computed_at < ($3::date + interval '1 day'))
    ORDER BY performance.conversions DESC,performance.engagements DESC,performance.computed_at DESC,variant.id LIMIT $4 OFFSET $5`, values)
  const [totalResult, freshnessResult] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int total FROM content_performance performance JOIN content_variants variant ON variant.id=performance.variant_id JOIN content_items item ON item.id=variant.content_item_id WHERE ($1::uuid IS NULL OR item.campaign_id=$1) AND ($2::date IS NULL OR performance.computed_at >= $2::date) AND ($3::date IS NULL OR performance.computed_at < ($3::date + interval '1 day'))`, values.slice(0, 3)),
    pool.query<{ freshness: string | null }>(`SELECT max(performance.computed_at)::text freshness FROM content_performance performance JOIN content_variants variant ON variant.id=performance.variant_id JOIN content_items item ON item.id=variant.content_item_id WHERE ($1::uuid IS NULL OR item.campaign_id=$1) AND ($2::date IS NULL OR performance.computed_at >= $2::date) AND ($3::date IS NULL OR performance.computed_at < ($3::date + interval '1 day'))`, values.slice(0, 3)),
  ])
  const data = result.rows.slice(0, DATA_PAGE_SIZE)
  const columns = [{ accessorKey: 'variantId', header: 'Variant ID' }, { accessorKey: 'thesis', header: 'Tese' }, { accessorKey: 'contentTitle', header: 'Conteúdo' }, { accessorKey: 'channel', header: 'Canal' }, { accessorKey: 'format', header: 'Formato' }, { accessorKey: 'impressions', header: 'Impressões' }, { accessorKey: 'engagements', header: 'Engajamentos' }, { accessorKey: 'clicks', header: 'Cliques' }, { accessorKey: 'conversions', header: 'Conversões' }, { accessorKey: 'computedAt', header: 'Calculado em' }]
  const exportQuery = new URLSearchParams({ ...(params.from ? { from: params.from } : {}), ...(params.to ? { to: params.to } : {}) }).toString()
  return <section className="bridge-section"><header className="module-panel-header"><div><p className="module-eyebrow">Performance editorial</p><h2>Desempenho por variante</h2></div><a className="bridge-button" data-variant="secondary" href={appPath(`/api/performance/content/export${exportQuery ? `?${exportQuery}` : ''}`)}>Exportar CSV</a></header><KpiRow><KpiCard label="Variantes no período" value={Number(totalResult.rows[0]?.total ?? 0)} /><KpiCard label="Variantes exibidas" value={data.length} /></KpiRow><FreshnessLabel timestamp={freshnessResult.rows[0]?.freshness ?? null} source="content_performance.computed_at" /><DataPageControls page={params.page} hasNext={result.rows.length > DATA_PAGE_SIZE} from={params.from} to={params.to} />{data.length ? <DataGrid data={data} columns={columns} enableSorting label="Performance por variante" /> : <EmptyState message="Nenhuma métrica de conteúdo disponível no período." />}</section>
}
