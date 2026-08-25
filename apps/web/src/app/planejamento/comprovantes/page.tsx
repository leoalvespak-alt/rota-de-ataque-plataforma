import PublishingView from '../../publishing/view'
import { ModulePage } from '@/components/ModulePage'

export default function PlanningReceiptsPage() { return <ModulePage eyebrow="Planejamento editorial" title="Comprovantes" subtitle="Resultado da publicação e evidência operacional por canal." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Comprovantes', href: '/planejamento/comprovantes' }]} main={<PublishingView section="comprovantes" />} rail={<section><p className="module-eyebrow">Fonte</p><h2>Proveniência</h2><p>Estado e horário vêm do runtime de publicação, não de uma métrica estimada.</p></section>} /> }

