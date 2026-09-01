import RadarView from './view'

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <RadarView searchParams={searchParams} />
}
