import OpportunityView from '../../content-opportunity/view'
import { ModulePage } from '@/components/ModulePage'

export default function PlanningOpportunitiesPage() { return <ModulePage eyebrow="Planejamento editorial" title="Oportunidades" subtitle="Pautas derivadas de sinais e prontas para decisão humana." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Oportunidades', href: '/planejamento/oportunidades' }]} main={<OpportunityView />} rail={<section><p className="module-eyebrow">Próxima ação</p><h2>Validar evidência</h2><p>Uma oportunidade só avança quando sua origem e tese estão claras.</p></section>} /> }

