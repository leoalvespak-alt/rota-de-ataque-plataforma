import { RouteTabs } from '@/components/RouteTabs'
import OpportunityView from '../content-opportunity/view'
import ContentItemsView from '../content-items/view'
import ThesesView from '../theses/view'
import CreativeBridgeView from '../creative-bridge/view'
import { FunnelBoard } from './FunnelBoard'
import PublishingView from '../publishing/view'

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = typeof (await searchParams).aba === 'string' ? (await searchParams).aba as string : 'funil'
  const props = { searchParams: searchParams as never }
  const content = tab === 'oportunidades' ? <OpportunityView />
    : tab === 'conteudos' ? <ContentItemsView {...props} />
      : tab === 'teses' ? <ThesesView />
        : tab === 'ponte' ? <CreativeBridgeView />
          : tab === 'calendario' || tab === 'aprovacao' || tab === 'comprovantes' ? <PublishingView section={tab} />
            : <FunnelBoard />
  return <RouteTabs destinationId="content" activeTab={tab}>{content}</RouteTabs>
}
