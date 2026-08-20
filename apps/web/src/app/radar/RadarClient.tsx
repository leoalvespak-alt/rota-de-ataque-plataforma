'use client'

import { DataGrid, EmptyState, PageHeader } from '@plataforma/ui-bridge'
import { DataPageControls } from '@/components/DataPageControls'
import { helpRegistry } from '@/lib/help-registry'

export interface RadarRow { id: string; title: string; sourceName: string | null; sourceUrl: string | null; relevanceScore: number; phase: string | null; processed: string; publishedAt: string | null; createdAt: string }

export function RadarClient({ data, page, hasNext, from, to, campaignName }: { data: RadarRow[]; page: number; hasNext: boolean; from: string | null; to: string | null; campaignName: string | null }) {
  const columns = [{ accessorKey: 'title', header: 'Finding' }, { accessorKey: 'sourceName', header: 'Fonte' }, { accessorKey: 'relevanceScore', header: 'Relevância' }, { accessorKey: 'phase', header: 'Fase' }, { accessorKey: 'processed', header: 'Processamento' }, { accessorKey: 'createdAt', header: 'Criado em' }]
  return <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}><PageHeader title="Radar" subtitle={`Findings e notícias rastreados · ${campaignName ?? 'escopo global'}`} helpContent={helpRegistry['/radar'] ?? undefined} /><section style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}><DataPageControls page={page} hasNext={hasNext} from={from} to={to} />{data.length ? <DataGrid data={data} columns={columns} enableSorting label="Achados do radar" /> : <EmptyState message="Nenhum achado do radar no período." />}</section></main>
}
