'use client'

import { DataGrid, EmptyState, PageHeader } from '@plataforma/ui-bridge'
import { DataPageControls } from '@/components/DataPageControls'
import { helpRegistry } from '@/lib/help-registry'

export interface CommunityRow { id: string; name: string | null; size: number | null; cohesionScore: number | null; members: number; detectedAt: string | null; refreshedAt: string | null }

export function CommunityClient({ data, page, hasNext, from, to, campaignName }: { data: CommunityRow[]; page: number; hasNext: boolean; from: string | null; to: string | null; campaignName: string | null }) {
  const columns = [{ accessorKey: 'name', header: 'Comunidade' }, { accessorKey: 'members', header: 'Membros na campanha' }, { accessorKey: 'size', header: 'Tamanho detectado' }, { accessorKey: 'cohesionScore', header: 'Coesão' }, { accessorKey: 'refreshedAt', header: 'Atualizada em' }]
  return <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}><PageHeader title="Mapa de comunidades" subtitle={`Clusters ligados aos leads da campanha · ${campaignName ?? 'escopo global'}`} helpContent={helpRegistry['/community'] ?? undefined} /><section style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}><DataPageControls page={page} hasNext={hasNext} from={from} to={to} />{data.length ? <DataGrid data={data} columns={columns} enableSorting label="Comunidades" /> : <EmptyState message="Nenhuma comunidade disponível no período." />}</section></main>
}
