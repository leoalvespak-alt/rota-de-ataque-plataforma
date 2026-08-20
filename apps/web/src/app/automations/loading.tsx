import { KpiSkeleton, TableSkeleton } from '@plataforma/ui-bridge'

export default function Loading() {
  return <main className="bridge-page-content" aria-busy="true" aria-label="Carregando automações">
    <KpiSkeleton count={4} />
    <TableSkeleton rows={12} columns={7} />
  </main>
}
