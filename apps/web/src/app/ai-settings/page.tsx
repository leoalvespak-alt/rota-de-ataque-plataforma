import { createDatabase } from '@plataforma/db'
import { AISettingsClient, type AIModelRow, type AIProviderRow } from './AISettingsClient'

export const dynamic = 'force-dynamic'

export default async function AISettingsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const [providers, models] = await Promise.all([
      pool.query<AIProviderRow>(`SELECT id,name,kind,base_url,enabled,api_key_encrypted IS NOT NULL has_api_key,updated_at FROM ai_providers ORDER BY name`),
      pool.query<AIModelRow>(`SELECT model.id,model.provider_id,provider.name provider_name,model.label,model.model_id,model.enabled,model.is_default,model.supports_json,model.max_output_tokens,model.temperature::float8 temperature,model.updated_at FROM ai_models model JOIN ai_providers provider ON provider.id=model.provider_id ORDER BY model.is_default DESC,provider.name,model.label`),
    ])
    return <AISettingsClient initialProviders={providers.rows} initialModels={models.rows}/>
  } finally { await pool.end() }
}
