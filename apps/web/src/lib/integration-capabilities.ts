export interface IntegrationCapability {
  id: string
  name: string
  status: 'ready'|'partial'|'not_configured'|'disabled'|'degraded'|'rate_limited'|'budget_blocked'|'error'
  detail: string
  missing: string[]
}

interface Queryable {
  query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>
}

export async function getIntegrationCapabilities(database?: Queryable): Promise<IntegrationCapability[]> {
  let databaseReady = false
  let radarSources = 0
  let llmReady = Boolean(process.env.LLM_MODEL && process.env.LLM_ENDPOINT && process.env.LLM_API_KEY)
  if (database) {
    try {
      await database.query('SELECT 1')
      databaseReady = true
    } catch {}
    try {
      radarSources = Number((await database.query<{ count: number }>('SELECT count(*)::int count FROM news_sources WHERE active=true')).rows[0]?.count ?? 0)
    } catch {}
    try {
      llmReady = llmReady || Boolean((await database.query<{ ready: boolean }>('SELECT EXISTS(SELECT 1 FROM ai_models model JOIN ai_providers provider ON provider.id=model.provider_id WHERE model.is_default AND model.enabled AND provider.enabled AND provider.deleted_at IS NULL) ready')).rows[0]?.ready)
    } catch {}
  }
  return [
    { id: 'database', name: 'Banco editorial', status: databaseReady ? 'ready' : 'error', missing: databaseReady ? [] : ['DATABASE_URL'], detail: databaseReady ? 'PostgreSQL editorial respondendo.' : 'Banco editorial indisponível.' },
    { id: 'radar', name: 'Fontes do Radar', status: radarSources > 0 ? 'ready' : 'partial', missing: radarSources > 0 ? [] : ['news_sources.active'], detail: radarSources > 0 ? radarSources + ' fonte(s) ativa(s) cadastrada(s).' : 'Nenhuma fonte ativa cadastrada.' },
    { id: 'llm', name: 'Modelo editorial', status: llmReady ? 'ready' : 'not_configured', missing: llmReady ? [] : ['LLM_MODEL', 'LLM_ENDPOINT', 'LLM_API_KEY'], detail: llmReady ? 'Modelo padrão disponível para tarefas editoriais.' : 'Modelo editorial ainda não configurado.' },
    { id: 'design-bridge', name: 'Design System', status: process.env.DESIGN_WEB_ORIGIN ? 'ready' : 'partial', missing: process.env.DESIGN_WEB_ORIGIN ? [] : ['DESIGN_WEB_ORIGIN'], detail: process.env.DESIGN_WEB_ORIGIN ? 'Frontend e API do Design disponíveis no gateway editorial.' : 'Gateway do Design ainda não configurado.' },
  ]
}
