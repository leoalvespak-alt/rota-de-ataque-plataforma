import { Suspense } from 'react'
import { CommunityClient } from './CommunityClient'

function TableSkeleton() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando dados...</div>
}

export default async function CommunityPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CommunityData />
    </Suspense>
  )
}

async function CommunityData() {
  // Dummy SQL query mock
  await new Promise(resolve => setTimeout(resolve, 500))
  const data: any[] = []
  return <CommunityClient data={data} />
}
