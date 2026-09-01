import { createDatabase } from '@plataforma/db'
import { getIntegrationCapabilities } from '@/lib/integration-capabilities'

export default async function SystemIntegrationsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const capabilities = await getIntegrationCapabilities(pool)
    return <main className="page"><header className="page-header"><p className="module-eyebrow">Sistema</p><h1>Integrações editoriais</h1><p>Estado das dependências do Radar, do editorial e do Design System.</p></header><section className="module-list">{capabilities.map((capability) => <article key={capability.id}><strong>{capability.name}</strong><span>{capability.status}</span><small>{capability.detail}</small>{capability.missing.length > 0 && <small>Ausente: {capability.missing.join(', ')}</small>}</article>)}</section></main>
  } finally {
    await pool.end()
  }
}
