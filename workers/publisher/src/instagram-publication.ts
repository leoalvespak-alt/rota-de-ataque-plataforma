interface Queryable {
  query(sql: string, values?: unknown[]): Promise<unknown>
}

export async function recordPublishedInstagram(database: Queryable, variantId: string, igMediaId: string) {
  await database.query(
    `INSERT INTO content_publications(variant_id,channel,external_id)
     SELECT $1,'instagram',$2
     WHERE NOT EXISTS(SELECT 1 FROM content_publications WHERE variant_id=$1 AND channel='instagram')`,
    [variantId, igMediaId],
  )
  await database.query(
    `UPDATE content_variants SET status='published',published_at=now(),external_ref=jsonb_build_object('id',$2) WHERE id=$1`,
    [variantId, igMediaId],
  )
}
