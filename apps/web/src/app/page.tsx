import { DashboardPage } from '@/components/DashboardPage'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  return <DashboardPage view="overview" title="Overview" subtitle="Aquisição, funil, relacionamento e saúde da campanha ativa" searchParams={params} helpKey="/" /> 
}
