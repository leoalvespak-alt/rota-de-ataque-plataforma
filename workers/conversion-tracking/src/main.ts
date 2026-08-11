import { createDatabase } from '@plataforma/db'
import { MetaApiClient } from '@plataforma/meta-api'
import { runWorker } from '@plataforma/queue/runtime'
import { createConversionTrackingProcessor, spec, type ConversionRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
const token = process.env.META_ACCESS_TOKEN
if (!databaseUrl || !token) throw new Error('DATABASE_URL and META_ACCESS_TOKEN are required')
const { pool } = createDatabase(databaseUrl)
const meta = new MetaApiClient(token, process.env.META_API_VERSION ?? 'v21.0')

const repository: ConversionRepository = {
  async snapshot(payload) {
    const account = (await pool.query<{ meta_ig_user_id: string }>('SELECT meta_ig_user_id FROM accounts WHERE id = $1', [payload.accountId])).rows[0]
    if (!account?.meta_ig_user_id) throw new Error('Account is not connected to a Meta Instagram user')
    const [profile, insights] = await Promise.all([meta.self.profile(account.meta_ig_user_id), meta.self.insights(account.meta_ig_user_id)])
    const metric = Object.fromEntries(insights.data.map((item: Record<string, unknown>) => {
      const values = Array.isArray(item.values) ? item.values as Array<Record<string, unknown>> : []
      return [String(item.name), Number(values[0]?.value ?? 0)]
    })) as Record<string, number>
    return {
      followers: Number(profile.followers_count ?? 0), follows: Number(profile.follows_count ?? 0), posts: Number(profile.media_count ?? 0),
      reach7d: metric.reach, impressions7d: metric.impressions,
    }
  },
  async persist(payload, snapshot, traceId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const previous = (await client.query<{ followers_count: number }>(
        `SELECT followers_count FROM profile_snapshots WHERE account_id = $1 ORDER BY captured_at DESC LIMIT 1`,
        [payload.accountId],
      )).rows[0]
      await client.query(
        `INSERT INTO profile_snapshots(account_id, followers_count, follows_count, posts_count, reach_7d, impressions_7d)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [payload.accountId, snapshot.followers, snapshot.follows, snapshot.posts, snapshot.reach7d ?? null, snapshot.impressions7d ?? null],
      )
      const delta = snapshot.followers - Number(previous?.followers_count ?? snapshot.followers)
      let conversions = 0
      if (payload.campaignId && delta > 0) {
        const actions = await client.query<{ lead_id: string }>(
          `SELECT DISTINCT lead_id FROM engagement_actions
           WHERE campaign_id = $1 AND account_id = $2 AND status = 'done'
             AND completed_at >= now() - interval '24 hours' LIMIT $3`,
          [payload.campaignId, payload.accountId, delta],
        )
        for (const action of actions.rows) {
          const conversion = await client.query<{ id: string }>(
            `INSERT INTO conversion_events(lead_id, campaign_id, kind, value, source, ref)
             VALUES($1, $2, 'profile_follow_delta', 1, 'meta', $3::jsonb) RETURNING id`,
            [action.lead_id, payload.campaignId, JSON.stringify({ traceId, followerDelta: delta })],
          )
          await client.query(
            `INSERT INTO attributions(lead_id, campaign_id, first_action_at, last_action_at, conversion_event_id, action_path)
             VALUES($1, $2, now() - interval '24 hours', now(), $3, $4::jsonb)`,
            [action.lead_id, payload.campaignId, conversion.rows[0]!.id, JSON.stringify([{ type: 'engagement_action', traceId }])],
          )
          conversions++
        }
      }
      await client.query('COMMIT')
      return { conversions }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

runWorker(spec.queue, createConversionTrackingProcessor(repository))
