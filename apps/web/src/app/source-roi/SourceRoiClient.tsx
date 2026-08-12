'use client'

import { PageHeader, EmptyState } from '@plataforma/ui-bridge'
import { helpRegistry } from '@/lib/help-registry'

export function SourceRoiClient({ data }: { data: any[] }) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader 
        title="ROI por origem" 
        subtitle="Qualidade, retenção e conversão por origem" 
        helpContent={helpRegistry['/source-roi'] ?? undefined} 
      />
      <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}>
        <EmptyState message="Nenhuma métrica de ROI disponível no momento." />
      </div>
    </div>
  )
}
