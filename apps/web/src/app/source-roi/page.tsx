import { Suspense } from 'react'
import { SourceRoiClient } from './SourceRoiClient'

function TableSkeleton() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando dados...</div>
}

export default async function SourceRoiPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <SourceRoiData />
    </Suspense>
  )
}

async function SourceRoiData() {
  // Dummy SQL query mock
  await new Promise(resolve => setTimeout(resolve, 500))
  const data: any[] = []
  return <SourceRoiClient data={data} />
}
