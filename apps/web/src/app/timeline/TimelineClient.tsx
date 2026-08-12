'use client'

import { PageHeader, EmptyState } from '@plataforma/ui-bridge'
import { helpRegistry } from '@/lib/help-registry'

export function TimelineClient({ data }: { data: any[] }) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader 
        title="Timeline" 
        subtitle="Histórico unificado de descoberta, ações, reciprocidade e conversão" 
        helpContent={helpRegistry['/timeline'] ?? undefined} 
      />
      <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}>
        <EmptyState message="Nenhum evento registrado no momento." />
      </div>
    </div>
  )
}
