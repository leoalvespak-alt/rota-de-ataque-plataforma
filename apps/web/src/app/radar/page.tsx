import { Suspense } from 'react'
import { RadarClient } from './RadarClient'

function TableSkeleton() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando dados...</div>
}

export default async function RadarPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <RadarData />
    </Suspense>
  )
}

async function RadarData() {
  // Dummy SQL query mock
  await new Promise(resolve => setTimeout(resolve, 500))
  const data: any[] = []
  return <RadarClient data={data} />
}
