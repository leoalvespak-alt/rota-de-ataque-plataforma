'use client'

import { DataGrid, EmptyState, FreshnessLabel, KpiCard, KpiRow, PageHeader } from '@plataforma/ui-bridge'
import { DataPageControls } from '@/components/DataPageControls'
import { appPath } from '@/lib/base-path'
import { helpRegistry } from '@/lib/help-registry'

export interface SourceRoiRow { id: string; sourceType: string | null; sourceId: string | null; windowDays: number | null; uniqueLeads: number | null; followbackRate: number | null; retention7dRate: number | null; conversionRate: number | null; sourceScore: number | null; computedAt: string }

export function SourceRoiClient({ data, page, hasNext, from, to, campaignName, total, freshness }: { data: SourceRoiRow[]; page: number; hasNext: boolean; from: string | null; to: string | null; campaignName: string | null; total: number; freshness: string | null }) {
  const columns = [{ accessorKey: 'sourceType', header: 'Tipo' }, { accessorKey: 'sourceId', header: 'Origem' }, { accessorKey: 'windowDays', header: 'Janela (dias)' }, { accessorKey: 'uniqueLeads', header: 'Leads únicos' }, { accessorKey: 'followbackRate', header: 'Followback' }, { accessorKey: 'retention7dRate', header: 'Retenção 7d' }, { accessorKey: 'conversionRate', header: 'Conversão' }, { accessorKey: 'sourceScore', header: 'Score' }, { accessorKey: 'computedAt', header: 'Calculado em' }]
  const exportQuery = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()
  return <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}><PageHeader title="ROI por origem" subtitle={`Qualidade, retenção e conversão · ${campaignName ?? 'escopo global'}`} helpContent={helpRegistry['/source-roi'] ?? undefined} actions={<a className="bridge-button" data-variant="secondary" href={appPath(`/api/performance/source-roi/export${exportQuery ? `?${exportQuery}` : ''}`)}>Exportar CSV</a>} /><KpiRow><KpiCard label="Origens no período" value={total} /><KpiCard label="Amostra exibida" value={data.length} /></KpiRow><FreshnessLabel timestamp={freshness} source="source_metrics.computed_at" /><section style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}><DataPageControls page={page} hasNext={hasNext} from={from} to={to} />{data.length ? <DataGrid data={data} columns={columns} enableSorting label="ROI por origem" /> : <EmptyState message="Nenhuma métrica de ROI disponível no período." />}</section></main>
}
