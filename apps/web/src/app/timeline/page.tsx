import { Suspense } from 'react'
import { TimelineClient } from './TimelineClient'

function TableSkeleton() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando dados...</div>
}

export default async function TimelinePage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <TimelineData />
    </Suspense>
  )
}

async function TimelineData() {
  // Dummy SQL query mock
  await new Promise(resolve => setTimeout(resolve, 500))
  const data: any[] = []
  return <TimelineClient data={data} />
}
