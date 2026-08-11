import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { getIntegrationCapabilities } from '@/lib/integration-capabilities'
import { MarketRadarClient } from './MarketRadarClient'

export const dynamic='force-dynamic'
export default async function MarketRadarPage(){const{pool}=createDatabase(process.env.DATABASE_URL!);try{const{selected}=await getCampaignContext(pool);const[signals,watches,capabilities]=await Promise.all([pool.query(`SELECT id,label,kind,velocity_7d,velocity_30d,volume_current,status,last_seen_at,evidence_refs FROM market_signals WHERE ($1::uuid IS NULL OR campaign_id=$1) ORDER BY velocity_7d DESC NULLS LAST,last_seen_at DESC LIMIT 200`,[selected?.id??null]),pool.query(`SELECT id,kind,value,active,last_run_at,next_run_at FROM reddit_watches WHERE ($1::uuid IS NULL OR campaign_id=$1) ORDER BY active DESC,next_run_at NULLS FIRST`,[selected?.id??null]),getIntegrationCapabilities(pool)]);return <MarketRadarClient initialSignals={signals.rows} initialWatches={watches.rows} redditStatus={capabilities.find((item)=>item.id==='reddit')??null}/>}finally{await pool.end()}}
