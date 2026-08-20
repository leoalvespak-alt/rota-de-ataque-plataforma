import { cookies } from 'next/headers'

export const CAMPAIGN_COOKIE = 'prospector_campaign'

export interface CampaignOption {
  id: string
  name: string
}

interface Queryable {
  query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>
}

export async function listActiveCampaigns(database: Queryable): Promise<CampaignOption[]> {
  return (await database.query<CampaignOption>(
    `SELECT id,name FROM campaigns
     WHERE status='active'
     ORDER BY (name = 'Rota de Ataque') DESC, name`,
  )).rows
}

export async function getCampaignContext(database: Queryable) {
  const campaigns = await listActiveCampaigns(database)
  const selectedId = (await cookies()).get(CAMPAIGN_COOKIE)?.value
  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? campaigns[0] ?? null
  return { campaigns, selected }
}
