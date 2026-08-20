import { Suspense } from 'react'
import { CompetitiveIntelClient } from './CompetitiveIntelClient'

function TableSkeleton() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando dados...</div>
}

export default async function CompetitiveIntelPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CompetitiveIntelData />
    </Suspense>
  )
}

async function CompetitiveIntelData() {
  // Dummy SQL query mock
  await new Promise(resolve => setTimeout(resolve, 500))
  const data: any[] = []
  return <CompetitiveIntelClient data={data} />
}
