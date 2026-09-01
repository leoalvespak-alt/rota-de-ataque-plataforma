import Link from 'next/link'
import { notFound } from 'next/navigation'

const runbooks: Record<string, { title: string; checks: string[]; recovery: string[] }> = {
  'system-health': { title: 'Saúde do sistema', checks: ['Confirme o liveness do Prospector, Design e Caddy.', 'Verifique o ledger de migrations e a conexão via PgBouncer.', 'Preserve traceId e não registre credenciais.'], recovery: ['Corrija somente a dependência indicada.', 'Reinicie o serviço local afetado e aguarde o healthcheck.', 'Valide novamente a Rota separadamente antes de encerrar.'] },
  'editorial-core': { title: 'Núcleo editorial', checks: ['Confira Radar, teses, oportunidades e itens de conteúdo.', 'Verifique a fila humana e a ponte criativa.', 'Não acione integrações externas durante esta fase.'], recovery: ['Valide a migration atual sem reescrever o histórico.', 'Reprocesse somente entradas editoriais idempotentes.', 'Registre a decisão e o estado resultante no audit log.'] },
  web: { title: 'Interface web', checks: ['Copie o traceId exibido no erro.', 'Confira o status da API e do banco.', 'Tente novamente uma única vez para descartar falha transitória.'], recovery: ['Preserve o identificador e o horário.', 'Valide Caddy e o healthcheck do container.', 'Recarregue a rota e confirme que os dados permanecem estáveis.'] },
}

export default async function Runbook({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = runbooks[slug.replace(/\.md$/u, '')]
  if (!item) notFound()
  return <main className="page"><p className="eyebrow">Runbook operacional</p><h1>{item.title}</h1><section className="card"><h2>Diagnóstico</h2><ol>{item.checks.map((step) => <li key={step}>{step}</li>)}</ol></section><section className="card"><h2>Recuperação segura</h2><ol>{item.recovery.map((step) => <li key={step}>{step}</li>)}</ol></section><Link href="/sistema/avancado/runbooks">Voltar para Runbooks</Link></main>
}
