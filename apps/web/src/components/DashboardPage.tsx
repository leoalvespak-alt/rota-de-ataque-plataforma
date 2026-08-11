import { loadDashboardView, type DashboardView } from '@/lib/dashboard-data'
import { OperationalDashboard } from './OperationalDashboard'

export async function DashboardPage({ view, title, subtitle, pane = false }: { view: DashboardView; title: string; subtitle: string; pane?: boolean }) {
  const result = await loadDashboardView(view)
  return <OperationalDashboard view={view} title={title} subtitle={subtitle} pane={pane} initialItems={result.items} initialGeneratedAt={result.generatedAt}/>
}
