'use client'

import { PageHeader, EmptyState } from '@plataforma/ui-bridge'
import { helpRegistry } from '@/lib/help-registry'

export function RadarClient({ data }: { data: any[] }) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader 
        title="Radar" 
        subtitle="Posts em ascensão e oportunidades quase em tempo real" 
        helpContent={helpRegistry['/radar'] ?? undefined} 
      />
      <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}>
        <EmptyState message="Nenhum post no radar no momento." />
      </div>
    </div>
  )
}
