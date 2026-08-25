import { ModulePage } from '@/components/ModulePage'
import { FunnelBoard } from '../../conteudo/FunnelBoard'

export default function PlanningFunnelPage() {
  return <ModulePage eyebrow="Planejamento editorial" title="Funil" subtitle="Cinco etapas com contagem, permanência e bloqueios calculados a partir do banco." metrics={[]} navigation={[{ label: 'Visão geral', href: '/planejamento' }, { label: 'Funil', href: '/planejamento/funil' }]} main={<FunnelBoard />} rail={<section><p className="module-eyebrow">Leitura</p><h2>Permanência real</h2><p>Variantes usam seu timestamp próprio. Ausência de ligação e proteção manual aparecem como estados explícitos.</p></section>} />
}

