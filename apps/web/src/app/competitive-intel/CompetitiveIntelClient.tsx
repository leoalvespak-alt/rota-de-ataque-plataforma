'use client'

import { DataGrid, EmptyState, PageHeader } from '@plataforma/ui-bridge'
import { DataPageControls } from '@/components/DataPageControls'
import { helpRegistry } from '@/lib/help-registry'

export interface CompetitiveIntelRow { id: string; kind: 'insight' | 'suggestion'; origin: string; competitor: string; title: string; description: string | null; curationState: string; evidenceUrl: string | null; createdAt: string }

export function CompetitiveIntelClient({ data, page, hasNext, from, to, campaignName }: { data: CompetitiveIntelRow[]; page: number; hasNext: boolean; from: string | null; to: string | null; campaignName: string | null }) {
  const columns = [{ accessorKey: 'origin', header: 'Origem' }, { accessorKey: 'competitor', header: 'Concorrente' }, { accessorKey: 'title', header: 'Insight / sugestão' }, { accessorKey: 'curationState', header: 'Curadoria' }, { accessorKey: 'createdAt', header: 'Criado em' }]
  return <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}><PageHeader title="Inteligência competitiva" subtitle={`Insights e sugestões com evidência · ${campaignName ?? 'escopo global'}`} helpContent={helpRegistry['/competitive-intel'] ?? undefined} /><section style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}><DataPageControls page={page} hasNext={hasNext} from={from} to={to} />{data.length ? <DataGrid data={data} columns={columns} enableSorting label="Insights competitivos" /> : <EmptyState message="Nenhum dado competitivo disponível no período." />}</section></main>
}
