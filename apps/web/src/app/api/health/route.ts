import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { Redis } from 'ioredis'

export const dynamic = 'force-dynamic'

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL
  const redisUrl = process.env.REDIS_URL
  const embeddingsUrl = process.env.EMBEDDINGS_ENDPOINT
  if (!databaseUrl || !redisUrl || !embeddingsUrl) return NextResponse.json({ ok: false, error: 'missing_runtime_config' }, { status: 503 })

  const { pool } = createDatabase(databaseUrl)
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 3_000 })
  try {
    const [database, cache, embeddings] = await Promise.all([
      pool.query('SELECT 1').then(() => 'ok'),
      redis.connect().then(() => redis.ping()).then((value) => value === 'PONG' ? 'ok' : 'error'),
      fetch(`${embeddingsUrl}/info`, { signal: AbortSignal.timeout(3_000) }).then((response) => response.ok ? 'ok' : 'error'),
    ])
    const ok = database === 'ok' && cache === 'ok' && embeddings === 'ok'
    return NextResponse.json({ ok, service: 'web', dependencies: { database, cache, embeddings }, at: new Date().toISOString() }, { status: ok ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({ ok: false, service: 'web', error: error instanceof Error ? error.name : 'healthcheck_failed' }, { status: 503 })
  } finally {
    await Promise.allSettled([pool.end(), redis.quit()])
  }
}
