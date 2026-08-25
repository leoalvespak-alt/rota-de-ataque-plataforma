import SourceRoiView from '../../source-roi/view'
export default function PerformanceRoiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <SourceRoiView searchParams={searchParams as never} /> }

