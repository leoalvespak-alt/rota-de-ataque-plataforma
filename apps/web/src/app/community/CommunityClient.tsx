'use client'

import { PageHeader, EmptyState } from '@plataforma/ui-bridge'
import { helpRegistry } from '@/lib/help-registry'

export function CommunityClient({ data }: { data: any[] }) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader 
        title="Mapa de comunidades" 
        subtitle="Clusters e relações entre leads identificados pela inteligência da campanha" 
        helpContent={helpRegistry['/community'] ?? undefined} 
      />
      <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}>
        <EmptyState message="Nenhuma comunidade disponível no momento." />
      </div>
    </div>
  )
}
