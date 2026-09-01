import Link from 'next/link'
import { ModulePage } from '@/components/ModulePage'

export default function SystemRunbooksPage() {
  return <ModulePage eyebrow="Sistema" title="Runbooks" subtitle="Guias curtos para operar o núcleo editorial com segurança." metrics={[]} navigation={[{ label: 'Sistema', href: '/sistema' }, { label: 'Runbooks', href: '/sistema/avancado/runbooks' }]} main={<section className="module-list"><Link href="/docs/runbooks/system-health"><strong>Saúde do sistema</strong><span>Banco, Caddy e liveness dos serviços.</span></Link><Link href="/docs/runbooks/editorial-core"><strong>Núcleo editorial</strong><span>Radar, oportunidades, itens, aprovação e ponte criativa.</span></Link></section>} rail={<section><p className="module-eyebrow">Escopo</p><h2>Sem outbound</h2><p>Integrações externas e execução de canais serão retomadas em fases posteriores.</p></section>} />
}
