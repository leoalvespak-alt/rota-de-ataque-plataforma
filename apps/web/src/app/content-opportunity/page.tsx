import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { ContentOpportunityClient } from './ContentOpportunityClient'
export default async function Page(){const{pool}=createDatabase(process.env.DATABASE_URL!);try{const{selected}=await getCampaignContext(pool);const items=(await pool.query(`SELECT id,thesis,angle,hook,evidence,opportunity_score,status,created_at FROM content_opportunities WHERE ($1::uuid IS NULL OR campaign_id=$1) ORDER BY opportunity_score DESC,created_at DESC LIMIT 200`,[selected?.id??null])).rows;return <ContentOpportunityClient initialItems={items}/>}finally{}}
