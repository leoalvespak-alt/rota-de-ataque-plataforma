import { RouteTabs } from '@/components/RouteTabs'
import PublishingView from '../publishing/view'

export default async function PublishingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = typeof (await searchParams).aba === 'string' ? (await searchParams).aba as string : 'calendario'
  const section = tab === 'aprovacao' || tab === 'comprovantes' ? tab : 'calendario'
  return <RouteTabs destinationId="planning" activeTab={section}><PublishingView section={section} /></RouteTabs>
}
