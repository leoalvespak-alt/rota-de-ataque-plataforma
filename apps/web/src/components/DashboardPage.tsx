import { type DashboardView } from '@/lib/dashboard-data'
import { OperationalDashboard } from './OperationalDashboard'
import { helpRegistry } from '@/lib/help-registry'

export function DashboardPage({ 
  view, 
  title, 
  subtitle, 
  pane = false,
  helpKey,
  searchParams
}: { 
  view: DashboardView
  title: string
  subtitle: string
  pane?: boolean
  helpKey?: string
  searchParams?: { search?: string, selected?: string }
}) {
  const helpContent = helpKey ? helpRegistry[helpKey] : undefined

  return (
    <OperationalDashboard 
      view={view}
      title={title}
      subtitle={subtitle}
      pane={pane}
      searchParams={searchParams}
      helpContent={helpContent}
    />
  )
}
