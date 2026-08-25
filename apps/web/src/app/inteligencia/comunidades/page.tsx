import CommunityView from '../../community/view'
export default function IntelligenceCommunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <CommunityView searchParams={searchParams as never} /> }

