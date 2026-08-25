import CreativeBridgeView from '../../creative-bridge/view'
import { ModulePage } from '@/components/ModulePage'

export default function PlanningAssetsPage() { return <ModulePage eyebrow="Planejamento editorial" title="Ativos" subtitle="Galeria de mídia e entregas do Creative Bridge vinculadas ao conteúdo." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Ativos', href: '/planejamento/ativos' }]} main={<CreativeBridgeView />} rail={<section><p className="module-eyebrow">Ação segura</p><h2>Vincular ativo</h2><p>Selecionar, abrir e vincular permanecem disponíveis por teclado e touch.</p></section>} /> }

