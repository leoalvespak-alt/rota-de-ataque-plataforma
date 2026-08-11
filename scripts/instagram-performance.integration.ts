import assert from "node:assert/strict";
import { createDatabase } from "@plataforma/db";
import { recordPublishedInstagram } from "../workers/publisher/src/instagram-publication.js";
import { upsertInstagramPerformance } from "../workers/meta-sync/src/instagram-performance.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const { pool } = createDatabase(databaseUrl);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const campaign = (
      await client.query<{ id: string }>(
        `INSERT INTO campaigns(name) VALUES('Instagram integration ' || gen_random_uuid()) RETURNING id`,
      )
    ).rows[0]!;
    const thesis = (
      await client.query<{ id: string }>(
        `INSERT INTO theses(campaign_id,slug,title,description) VALUES($1,'instagram-integration','Instagram integration','CI integration fixture') RETURNING id`,
        [campaign.id],
      )
    ).rows[0]!;
    const item = (
      await client.query<{ id: string }>(
        `INSERT INTO content_items(campaign_id,thesis_id,funnel_stage,hook,brand_voice_version,status) VALUES($1,$2,'awareness','Instagram integration ' || gen_random_uuid(),'ci','approved') RETURNING id`,
        [campaign.id, thesis.id],
      )
    ).rows[0]!;
    const variant = (
      await client.query<{ id: string }>(
        `INSERT INTO content_variants(content_item_id,channel,format,payload,status) VALUES($1,'instagram','image','{}','approved') RETURNING id`,
        [item.id],
      )
    ).rows[0]!;

    await recordPublishedInstagram(client, variant.id, "ig-media-integration");
    const metrics = {
      impressions: 120,
      reach: 80,
      engagements: 19,
      saves: 4,
      shares: 3,
    };
    await upsertInstagramPerformance(client, "ig-media-integration", metrics);
    await upsertInstagramPerformance(client, "ig-media-integration", metrics);

    const performance = (
      await client.query(
        `SELECT channel,impressions,reach,engagements,saves,shares FROM content_performance WHERE variant_id=$1`,
        [variant.id],
      )
    ).rows;
    assert.deepEqual(performance, [
      {
        channel: "instagram",
        impressions: 120,
        reach: 80,
        engagements: 19,
        saves: 4,
        shares: 3,
      },
    ]);
    await client.query(
      "REFRESH MATERIALIZED VIEW mv_content_performance_by_thesis",
    );
    const view = await client.query(
      `SELECT channel,impressions FROM mv_content_performance_by_thesis WHERE campaign_id=$1 AND thesis_id=$2`,
      [campaign.id, thesis.id],
    );
    assert.equal(view.rows[0]?.channel, "instagram");
    assert.equal(Number(view.rows[0]?.impressions), 120);
    await client.query("ROLLBACK");
    console.log(
      "Instagram publication -> meta-sync -> content performance integration passed",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
