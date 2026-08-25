import { RouteTabs } from '@/components/RouteTabs'
import ConversationsView from '../conversations/view'
import EmailFlowsView from '../email-flows/view'
import ContactPoliciesView from '../contact-policies/view'
import CommunitiesView from '../communities/view'
import LeadsView from '../leads/view'
import TimelineView from '../timeline/view'
import IdentitiesView from '../identities/view'

export default async function RelationshipPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = typeof (await searchParams).aba === 'string' ? (await searchParams).aba as string : 'conversas'
  const props = { searchParams: searchParams as never }
  const content = tab === 'leads' ? <LeadsView {...props} />
    : tab === 'timeline' ? <TimelineView {...props} />
      : tab === 'identidades' ? <IdentitiesView />
        : tab === 'email' ? <EmailFlowsView />
          : tab === 'politicas' ? <ContactPoliciesView />
            : tab === 'grupos' ? <CommunitiesView />
              : <ConversationsView />
  return <RouteTabs destinationId="relationship" activeTab={tab}>{content}</RouteTabs>
}
