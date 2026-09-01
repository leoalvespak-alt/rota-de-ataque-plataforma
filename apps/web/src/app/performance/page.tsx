import { ModulePage } from '@/components/ModulePage'
import Link from 'next/link'

export default function PerformancePage() {
  return <ModulePage eyebrow="Editorial" title="Performance" subtitle="A leitura de desempenho editorial será ampliada em uma fase posterior, após a estabilização do núcleo." metrics={[{ label: 'Escopo atual', value: 'Editorial', period: 'Radar → conteúdo', sourceStatus: 'ready' }]} navigation={[{ label: 'Visão geral', href: '/performance' }, { label: 'Conteúdo', href: '/performance/conteudo' }]} main={<section className="card"><h2>Desempenho de conteúdo</h2><p>O núcleo atual preserva a produção e a ponte criativa. Métricas de canais externos permanecem fora desta fase.</p><Link href="/performance/conteudo">Abrir conteúdo →</Link></section>} rail={<section><p className="module-eyebrow">Escopo</p><h2>Sem outbound</h2><p>Meta, email, WhatsApp e Threads serão tratados nas fases posteriores previstas no plano.</p></section>} />
}
