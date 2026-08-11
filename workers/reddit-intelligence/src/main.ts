import { createDatabase } from '@plataforma/db'
import { LocalEmbeddingsClient } from '@plataforma/nlp'
import { RedditClient, exchangeRedditRefreshToken } from '@plataforma/reddit-api'
import { runWorker } from '@plataforma/queue/runtime'
import { createRedditProcessor, spec, type RedditRepository, type RedditSource, type RedditWatch } from './index.js'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(process.env.DATABASE_URL)
const embeddings = new LocalEmbeddingsClient(process.env.EMBEDDINGS_ENDPOINT ?? 'http://embeddings:8080', process.env.EMBEDDINGS_MODEL ?? 'not-configured')
let clientPromise: Promise<RedditClient> | undefined
function redditClient() {
  if (!clientPromise) {
    const required = ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REFRESH_TOKEN', 'REDDIT_USER_AGENT', 'PII_HASH_SALT'] as const
    for (const name of required) if (!process.env[name]) throw new Error(`${name} is required when the Reddit worker is enabled`)
    clientPromise = exchangeRedditRefreshToken({ clientId: process.env.REDDIT_CLIENT_ID!, clientSecret: process.env.REDDIT_CLIENT_SECRET!, refreshToken: process.env.REDDIT_REFRESH_TOKEN! })
      .then((token) => new RedditClient(token, process.env.REDDIT_USER_AGENT!))
  }
  return clientPromise
}
const source: RedditSource = { async collect(watch) { const client = await redditClient(); return watch.kind === 'subreddit' ? client.subreddit(watch.value).new() : watch.kind === 'user' ? client.user(watch.value).comments() : client.search(watch.value) } }
const repository: RedditRepository = {
  async due(watchId) { const result = await pool.query<{ id:string;campaign_id:string;kind:RedditWatch['kind'];value:string;min_interval_seconds:number;max_interval_seconds:number }>(`SELECT id,campaign_id,kind,value,min_interval_seconds,max_interval_seconds FROM reddit_watches WHERE active=true AND ($1::uuid IS NOT NULL AND id=$1 OR $1::uuid IS NULL AND COALESCE(next_run_at,now())<=now()) ORDER BY next_run_at NULLS FIRST LIMIT 25`, [watchId ?? null]); return result.rows.map((row) => ({ id:row.id,campaignId:row.campaign_id,kind:row.kind,value:row.value,minIntervalSeconds:row.min_interval_seconds,maxIntervalSeconds:row.max_interval_seconds })) },
  async save(watch,item,text,authorHash,embedding) { const result=await pool.query<{id:string}>(`INSERT INTO reddit_evidence(watch_id,external_kind,external_id,author_hash,subreddit,permalink,text,score,num_comments,posted_at,embedding) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,to_timestamp($10),$11::vector) ON CONFLICT(external_kind,external_id) DO NOTHING RETURNING id`,[watch.id,item.body?'comment':'post',item.id,authorHash,item.subreddit,item.permalink ? `https://reddit.com${item.permalink}` : null,text,item.score??0,item.num_comments??0,item.created_utc??0,`[${embedding.join(',')}]`]); if(result.rows[0]) await pool.query(`INSERT INTO timeline_events(channel,event_type,campaign_id,external_ref,metadata,source) VALUES('reddit','reddit.evidence_collected',$1,$2::jsonb,$3::jsonb,'api')`,[watch.campaignId,JSON.stringify({reddit_evidence_id:result.rows[0].id}),JSON.stringify({subreddit:item.subreddit,score:item.score})]); return Boolean(result.rows[0]) },
  async schedule(watch,produced) { const seconds=produced>0?watch.minIntervalSeconds:Math.min(watch.maxIntervalSeconds,watch.minIntervalSeconds*2); await pool.query(`UPDATE reddit_watches SET last_run_at=now(),next_run_at=now()+($2||' seconds')::interval WHERE id=$1`,[watch.id,seconds]) },
  async upsertSignal(watch,item,text) { const question=/\?/.test(text); const kind=question?'question':/(versus| vs |compar)/i.test(text)?'comparison':/(comprar|curso|assinatura|preço|valor)/i.test(text)?'commercial_intent':'trend'; const label=(item.title||text).slice(0,180); await pool.query(`INSERT INTO market_signals(campaign_id,kind,label,evidence_refs,volume_current,first_seen_at,last_seen_at,status) VALUES($1,$2,$3,$4::jsonb,1,now(),now(),'new')`,[watch.campaignId,kind,label,JSON.stringify([{external_id:item.id}])]) }
}
runWorker(spec.queue, createRedditProcessor(repository, source, embeddings, process.env.PII_HASH_SALT ?? 'not-configured'))
