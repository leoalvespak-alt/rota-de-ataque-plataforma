import { DashboardPage } from '@/components/DashboardPage'
import { TodayClient } from '@/components/TodayClient'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  return <>
    <TodayClient />
    <section aria-labelledby="period-results"><h2 id="period-results" style={{ paddingInline: 24 }}>Resultado do período</h2>
      <DashboardPage view="overview" title="Visão histórica" subtitle="Aquisição, funil, relacionamento e saúde da campanha ativa" searchParams={params} helpKey="/" />
    </section>
  </>
}
