import { createDatabase, createPostgresHeartbeatStore } from "@plataforma/db";
import { MetaApiClient, type MetaMedia } from "@plataforma/meta-api";
import { createQueueRegistry, enqueueOnce } from "@plataforma/queue";
import { runWorker } from "@plataforma/queue/runtime";
import { logger } from "@plataforma/shared";
import { startWorkerHeartbeat } from "@plataforma/shared/worker";
import {
  createMetaSyncProcessor,
  spec,
  type CompetitorTarget,
  type MetaSyncRepository,
} from "./index.js";
import {
  normalizeInstagramInsights,
  upsertInstagramPerformance,
} from "./instagram-performance.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const accessToken = process.env.META_ACCESS_TOKEN;
const igUserId = process.env.META_INSTAGRAM_ACCOUNT_ID;
if (!databaseUrl || !redisUrl || !accessToken || !igUserId)
  throw new Error(
    "DATABASE_URL, REDIS_URL, META_ACCESS_TOKEN and META_INSTAGRAM_ACCOUNT_ID are required",
  );

const { pool } = createDatabase(databaseUrl);
const registry = createQueueRegistry(redisUrl);
const api = new MetaApiClient(
  accessToken,
  process.env.META_API_VERSION ?? "v21.0",
);

const repository: MetaSyncRepository = {
  async activeCompetitors(filter) {
    const values: string[] = [];
    const clauses = ["cc.status='active'", "c.status='active'"];
    if (filter?.campaignId) {
      values.push(filter.campaignId);
      clauses.push(`cc.campaign_id=$${values.length}`);
    }
    if (filter?.competitorId) {
      values.push(filter.competitorId);
      clauses.push(`c.id=$${values.length}`);
    }
    const result = await pool.query<CompetitorTarget>(
      `SELECT cc.campaign_id AS "campaignId",c.id AS "competitorId",c.username FROM campaign_competitors cc JOIN competitors c ON c.id=cc.competitor_id WHERE ${clauses.join(" AND ")}`,
      values,
    );
    return result.rows;
  },
  async updateCompetitor(target, profile) {
    await pool.query(
      `UPDATE competitors SET instagram_user_id=COALESCE($2,instagram_user_id),followers_count=COALESCE($3,followers_count),follows_count=COALESCE($4,follows_count),media_count=COALESCE($5,media_count),biography=COALESCE($6,biography),profile_picture_url=COALESCE($7,profile_picture_url),last_synced_via_api_at=now() WHERE id=$1`,
      [
        target.competitorId,
        profile.id,
        profile.followers_count,
        profile.follows_count,
        profile.media_count,
        profile.biography,
        profile.profile_picture_url,
      ],
    );
  },
  async upsertPost(target, media) {
    const shortcode = media.id!;
    const result = await pool.query<{ id: string; inserted: boolean }>(
      `INSERT INTO posts(competitor_id,shortcode,post_url,posted_at,comment_count_shown,like_count_shown,caption,engagement_metrics,source)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'api') ON CONFLICT(competitor_id,shortcode) DO UPDATE SET post_url=EXCLUDED.post_url,comment_count_shown=EXCLUDED.comment_count_shown,like_count_shown=EXCLUDED.like_count_shown,caption=EXCLUDED.caption,engagement_metrics=EXCLUDED.engagement_metrics
      RETURNING id,(xmax=0) AS inserted`,
      [
        target.competitorId,
        shortcode,
        media.permalink,
        media.timestamp ?? null,
        media.comments_count ?? 0,
        media.like_count ?? 0,
        media.caption ?? null,
        JSON.stringify({ media_type: media.media_type }),
      ],
    );
    return result.rows[0]!;
  },
  async saveOwnSnapshot(
    accountId,
    profile,
    media,
    insights,
    mentions,
    conversations,
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE accounts SET username=COALESCE($2::text,username),meta_ig_user_id=COALESCE($3::text,meta_ig_user_id),last_meta_sync_at=now() WHERE id=$1",
        [accountId, profile.username, profile.id],
      );
      const insightsByMedia = new Map(
        insights.map((entry) => [entry.mediaId, entry.data]),
      );
      for (const item of media) {
        if (!item.id) continue;
        const mediaInsights = insightsByMedia.get(item.id) ?? [];
        await client.query(
          `INSERT INTO own_media(account_id,ig_media_id,media_type,caption,permalink,posted_at,insights,last_synced_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(ig_media_id) DO UPDATE SET caption=EXCLUDED.caption,permalink=EXCLUDED.permalink,insights=EXCLUDED.insights,last_synced_at=now()`,
          [
            accountId,
            item.id,
            item.media_type,
            item.caption,
            item.permalink,
            item.timestamp,
            JSON.stringify(mediaInsights),
          ],
        );
        // content_performance receives cumulative Meta totals; the helper uses GREATEST so repeated syncs stay idempotent.
        await upsertInstagramPerformance(
          client,
          item.id,
          normalizeInstagramInsights(mediaInsights, {
            likes: item.like_count,
            comments: item.comments_count,
          }),
        );
      }
      for (const mention of mentions)
        await client.query(
          `INSERT INTO own_mentions(account_id,ig_mention_id,from_username,text,mentioned_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(ig_mention_id) DO NOTHING`,
          [
            accountId,
            mention.id,
            mention.username,
            mention.caption,
            mention.timestamp,
          ],
        );
      for (const conversation of conversations)
        await client.query(
          `INSERT INTO own_dm_threads(account_id,ig_thread_id,participant_username,participant_ig_user_id,last_message_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(ig_thread_id) DO UPDATE SET last_message_at=EXCLUDED.last_message_at`,
          [
            accountId,
            conversation.id,
            JSON.stringify(conversation.participants ?? null),
            null,
            conversation.updated_time ?? null,
          ],
        );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async incrementRateLimit(accountId) {
    await pool.query(
      `INSERT INTO account_health(account_id,api_rate_limited_count) VALUES($1,1)`,
      [accountId],
    );
  },
};

const queue = {
  extraction: (
    postId: string,
    runId: string,
    payload: Record<string, unknown>,
  ) =>
    enqueueOnce(
      registry.queues.extraction,
      "extraction",
      ["post", postId, "extraction", runId],
      payload,
    ).then(() => undefined),
};
const processJob = createMetaSyncProcessor(repository, queue, api);
const worker = runWorker(spec.queue, async (job) => {
  let collectorAccountId = job.payload.collectorAccountId as string | undefined;
  if (job.payload.kind === "competitor" && !collectorAccountId) {
    const collector = await pool.query<{ id: string }>(
      `SELECT id FROM accounts WHERE role='collector' AND status='HEALTHY' AND (cooldown_until IS NULL OR cooldown_until <= now()) ORDER BY last_action_at ASC NULLS FIRST,id LIMIT 1`,
    );
    collectorAccountId = collector.rows[0]?.id;
  }
  return processJob({
    ...job,
    payload: {
      ...job.payload,
      collectorAccountId,
      igUserId: String(job.payload.igUserId ?? igUserId),
    } as never,
  });
});
const stopHeartbeat = startWorkerHeartbeat(
  spec.queue,
  createPostgresHeartbeatStore(pool),
  () => ({
    jobsDone: 0,
    jobsFailed: 0,
    backlog: 0,
    p95LatencyMs: 0,
    state: worker?.isRunning() ? "running" : "disabled",
  }),
);

process.once(
  "SIGTERM",
  () =>
    void stopHeartbeat()
      .finally(() => pool.end())
      .finally(() => registry.connection.quit()),
);
logger.info({ worker: spec.queue }, "meta sync runtime initialized");
