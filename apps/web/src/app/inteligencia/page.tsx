import { RouteTabs } from '@/components/RouteTabs'
import RadarView from '../radar/view'
import MarketRadarView from '../market-radar/view'
import CompetitiveIntelView from '../competitive-intel/view'
import CommunityView from '../community/view'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function IntelligencePage({ searchParams }: { searchParams: SearchParams }) {
  const tab = typeof (await searchParams).aba === 'string' ? (await searchParams).aba as string : 'radar'
  const props = { searchParams: searchParams as never }
  const content = tab === 'mercado' ? <MarketRadarView />
    : tab === 'concorrentes' ? <CompetitiveIntelView {...props} />
      : tab === 'comunidades' ? <CommunityView {...props} />
        : <RadarView {...props} />
  return <RouteTabs destinationId="discoveries" activeTab={tab}>{content}</RouteTabs>
}
