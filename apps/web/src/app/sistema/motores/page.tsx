import AutomationsView from '../../automations/view'
export default function SystemEnginesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <AutomationsView searchParams={searchParams as never} /> }

