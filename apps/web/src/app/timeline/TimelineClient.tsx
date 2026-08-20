'use client'

import { DataGrid, EmptyState, PageHeader } from '@plataforma/ui-bridge'
import { DataPageControls } from '@/components/DataPageControls'
import { helpRegistry } from '@/lib/help-registry'

export interface TimelineRow { id: string; lead: string | null; channel: string; eventType: string; at: string; source: string; correlation: string | null; campaign: string | null }

export function TimelineClient({ data, page, hasNext, from, to, campaignName }: { data: TimelineRow[]; page: number; hasNext: boolean; from: string | null; to: string | null; campaignName: string | null }) {
  const columns = [{ accessorKey: 'at', header: 'Quando' }, { accessorKey: 'eventType', header: 'Evento' }, { accessorKey: 'channel', header: 'Canal' }, { accessorKey: 'lead', header: 'Lead' }, { accessorKey: 'source', header: 'Origem' }, { accessorKey: 'correlation', header: 'Correlação' }]
  return <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}><PageHeader title="Timeline" subtitle={`Descoberta, ações, reciprocidade e conversão · ${campaignName ?? 'escopo global'}`} helpContent={helpRegistry['/timeline'] ?? undefined} /><section style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}><DataPageControls page={page} hasNext={hasNext} from={from} to={to} />{data.length ? <DataGrid data={data} columns={columns} enableSorting label="Eventos cronológicos" /> : <EmptyState message="Nenhum evento registrado no período." />}</section></main>
}
