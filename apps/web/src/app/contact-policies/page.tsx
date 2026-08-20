import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { ContactPoliciesClient } from './ContactPoliciesClient'

export default async function Page(){const{pool}=createDatabase(process.env.DATABASE_URL!);try{const{campaigns,selected}=await getCampaignContext(pool);const[policies,leads]=await Promise.all([
pool.query(`SELECT policy.id,policy.campaign_id,COALESCE(campaign.name,'Global') campaign,policy.channel,policy.cadence_seconds,policy.enabled,policy.rules FROM contact_policies policy LEFT JOIN campaigns campaign ON campaign.id=policy.campaign_id WHERE policy.campaign_id IS NULL OR $1::uuid IS NULL OR policy.campaign_id=$1 ORDER BY policy.enabled DESC,campaign NULLS FIRST,policy.channel NULLS FIRST`,[selected?.id??null]),
pool.query(`SELECT lead.id,lead.username_current FROM leads lead JOIN lead_scores score ON score.lead_id=lead.id WHERE ($1::uuid IS NULL OR score.campaign_id=$1) ORDER BY score.final_score DESC LIMIT 100`,[selected?.id??null])]);return <ContactPoliciesClient initialPolicies={policies.rows} campaigns={campaigns} selectedCampaignId={selected?.id??''} leads={leads.rows}/>}finally{await pool.end()}}
