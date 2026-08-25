import TimelineView from '../../timeline/view'
export default function AudienceTimelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <TimelineView searchParams={searchParams as never} /> }

