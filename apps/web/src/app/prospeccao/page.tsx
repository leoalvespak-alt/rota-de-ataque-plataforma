import { RouteTabs } from '@/components/RouteTabs'
import LeadsView from '../leads/view'
import TimelineView from '../timeline/view'
import IdentitiesView from '../identities/view'

export default async function ProspectingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = typeof (await searchParams).aba === 'string' ? (await searchParams).aba as string : 'leads'
  const props = { searchParams: searchParams as never }
  const content = tab === 'timeline' ? <TimelineView {...props} /> : tab === 'identidades' ? <IdentitiesView /> : <LeadsView {...props} />
  return <RouteTabs destinationId="audience" activeTab={tab}>{content}</RouteTabs>
}
