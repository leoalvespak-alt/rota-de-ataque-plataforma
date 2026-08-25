import CompetitiveIntelView from '../../competitive-intel/view'
export default function IntelligenceCompetitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <CompetitiveIntelView searchParams={searchParams as never} /> }

