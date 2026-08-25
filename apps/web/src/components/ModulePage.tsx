import type { ReactNode } from 'react'
import { MetricStrip, ModuleHeader, ModuleSubnav, WorkspaceGrid, type MetricViewModel } from '@plataforma/ui-bridge'

export function ModulePage({ eyebrow, title, subtitle, context, metrics, navigation, main, rail, actions }: { eyebrow: string; title: string; subtitle: string; context?: string; metrics: MetricViewModel[]; navigation?: Array<{ label: string; href: string }>; main: ReactNode; rail: ReactNode; actions?: ReactNode }) {
  return <main className="bridge-page-content"><ModuleHeader eyebrow={eyebrow} title={title} subtitle={subtitle} context={context} actions={actions} />{navigation && <ModuleSubnav items={navigation} />}<MetricStrip metrics={metrics} /><WorkspaceGrid main={main} rail={rail} /></main>
}

