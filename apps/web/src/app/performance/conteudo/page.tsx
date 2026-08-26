import { ContentPerformance } from '../../desempenho/ContentPerformance'
export default async function PerformanceContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <ContentPerformance searchParams={searchParams} /> }
