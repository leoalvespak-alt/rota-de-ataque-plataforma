import ContentItemsView from '../../content-items/view'
import { ModulePage } from '@/components/ModulePage'

export default function PlanningContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <ModulePage eyebrow="Planejamento editorial" title="Conteúdos" subtitle="Briefings, variantes, ativos e ciclo de vida editorial." metrics={[]} navigation={[{ label: 'Planejamento', href: '/planejamento' }, { label: 'Conteúdos', href: '/planejamento/conteudos' }]} main={<ContentItemsView searchParams={searchParams as never} />} rail={<section><p className="module-eyebrow">Ponte</p><h2>Creative Bridge</h2><p>Ativos aprovados continuam vinculados ao conteúdo que os originou.</p></section>} /> }

