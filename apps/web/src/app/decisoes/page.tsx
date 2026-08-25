import { RouteTabs } from '@/components/RouteTabs'
import ReviewInboxView from '../review-inbox/view'
import EngagementView from '../engagement-queue/view'

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const tab = typeof params.aba === 'string' ? params.aba : 'revisao'
  return <RouteTabs destinationId="decisions" activeTab={tab}>
    {tab === 'engajamento' ? <EngagementView /> : <ReviewInboxView />}
  </RouteTabs>
}
