'use client'

import { PageHeader, EmptyState } from '@plataforma/ui-bridge'
import { helpRegistry } from '@/lib/help-registry'

export function CompetitiveIntelClient({ data }: { data: any[] }) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader 
        title="Inteligência competitiva" 
        subtitle="Temas, dores, perguntas e hooks por concorrente" 
        helpContent={helpRegistry['/competitive-intel'] ?? undefined} 
      />
      <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}>
        <EmptyState message="Nenhum dado competitivo disponível no momento." />
      </div>
    </div>
  )
}
