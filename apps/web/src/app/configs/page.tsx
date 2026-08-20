import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { ConfigsClient } from './ConfigsClient'
export default async function Page(){const{pool}=createDatabase(process.env.DATABASE_URL!);try{const{selected}=await getCampaignContext(pool);const config=selected?(await pool.query(`SELECT config.campaign_id,campaign.name campaign,config.p0_threshold,config.p1_threshold,config.p2_threshold,config.lambda_freshness,config.source_weights FROM campaign_scoring_config config JOIN campaigns campaign ON campaign.id=config.campaign_id WHERE config.campaign_id=$1`,[selected.id])).rows[0]:null;if(!config)return null;return <ConfigsClient config={config}/>}finally{await pool.end()}}
