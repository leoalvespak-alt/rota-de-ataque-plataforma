import AutomationsView from '../automations/view'

export default function AutomationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AutomationsView searchParams={searchParams} />
}
