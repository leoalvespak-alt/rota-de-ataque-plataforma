import LeadsView from '../../leads/view'
export default function AudiencePeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <LeadsView searchParams={searchParams as never} /> }

