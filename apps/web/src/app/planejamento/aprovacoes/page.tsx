import PublishingView from '../../publishing/view'
import { ModulePage } from '@/components/ModulePage'

export default function PlanningApprovalsPage() { return <ModulePage eyebrow="Planejamento editorial" title="Aprovações" subtitle="Fila de aprovação e comprovantes da publicação." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Aprovações', href: '/planejamento/aprovacoes' }]} main={<PublishingView section="aprovacao" />} rail={<section><p className="module-eyebrow">Rastreabilidade</p><h2>Cada decisão tem registro</h2><p>Aprovar, rejeitar e cancelar devem manter auditoria e trace.</p></section>} /> }

