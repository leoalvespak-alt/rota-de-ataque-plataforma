import { createDatabase } from '@plataforma/db'
import { AISettingsClient, type AIModelRow, type AIProviderRow } from './AISettingsClient'

export default async function AISettingsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const [providers, models] = await Promise.all([
      pool.query<AIProviderRow>(`SELECT id,name,kind,base_url,enabled,secret_env_name,secret_configured,sync_status,managed_origin,version,updated_at FROM ai_providers WHERE deleted_at IS NULL ORDER BY name`),
      pool.query<AIModelRow>(`SELECT model.id,model.provider_id,provider.name provider_name,model.label,model.model_id,model.enabled,model.is_default,model.priority,model.supports_json,model.max_output_tokens,model.temperature::float8 temperature,model.version,model.updated_at FROM ai_models model JOIN ai_providers provider ON provider.id=model.provider_id WHERE provider.deleted_at IS NULL ORDER BY model.is_default DESC,model.priority ASC,model.label`),
    ])
    return <AISettingsClient initialProviders={providers.rows} initialModels={models.rows}/>
  } finally {}
}
