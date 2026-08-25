import { RouteTabs } from '@/components/RouteTabs'
import SourceRoiView from '../source-roi/view'
import OrganicBudgetsView from '../organic-budgets/view'
import { ContentPerformance } from './ContentPerformance'

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = typeof (await searchParams).aba === 'string' ? (await searchParams).aba as string : 'roi'
  const props = { searchParams: searchParams as never }
  const content = tab === 'orcamento' ? <OrganicBudgetsView /> : tab === 'conteudo' ? <ContentPerformance /> : <SourceRoiView {...props} />
  return <RouteTabs destinationId="results" activeTab={tab}>{content}</RouteTabs>
}
