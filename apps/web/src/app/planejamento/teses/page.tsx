import ThesesView from '../../theses/view'
import { ModulePage } from '@/components/ModulePage'

export default function PlanningThesesPage() { return <ModulePage eyebrow="Planejamento editorial" title="Teses" subtitle="Doutrina editorial usada para transformar sinais em pauta." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Teses', href: '/planejamento/teses' }]} main={<ThesesView />} rail={<section><p className="module-eyebrow">Governança</p><h2>Fonte manual</h2><p>Teses são configuradas com origem e status, sem dados simulados.</p></section>} /> }

