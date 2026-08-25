import RadarView from '../../radar/view'
export default function IntelligenceRadarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <RadarView searchParams={searchParams as never} /> }

