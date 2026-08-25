import PublishingView from '../../publishing/view'
import { ModulePage } from '@/components/ModulePage'

export default function PlanningCalendarPage() { return <ModulePage eyebrow="Planejamento editorial" title="Calendário" subtitle="Produção, aprovação, agendamento e publicação em uma linha do tempo real." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Calendário', href: '/planejamento/calendario' }]} main={<PublishingView section="calendario" />} rail={<section><p className="module-eyebrow">Guardrail</p><h2>Aprovação humana</h2><p>O calendário não publica por si só; somente variantes aprovadas entram no agendamento.</p></section>} /> }

