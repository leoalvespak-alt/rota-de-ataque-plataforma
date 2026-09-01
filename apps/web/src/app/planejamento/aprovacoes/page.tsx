import { ModulePage } from '@/components/ModulePage'
import ReviewInboxView from '../../review-inbox/view'

export default function PlanningApprovalsPage() {
  return <ModulePage eyebrow="Planejamento editorial" title="Aprovações" subtitle="Fila humana para validar radar, oportunidades e conteúdo." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Aprovações', href: '/planejamento/aprovacoes' }]} main={<ReviewInboxView />} rail={<section><p className="module-eyebrow">Rastreabilidade</p><h2>Cada decisão tem registro</h2><p>Aprovar, rejeitar e editar mantêm auditoria e o estado editorial explícito.</p></section>} />
}
