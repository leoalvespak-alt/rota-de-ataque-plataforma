import { createDatabase, encryptToken } from '@plataforma/db'

const current = process.env.META_ACCESS_TOKEN
const secret = process.env.META_APP_SECRET
const appId = process.env.META_APP_ID
const databaseUrl = process.env.DATABASE_URL
const keyValue = process.env.TOKEN_ENCRYPTION_KEY
if (!current || !secret || !appId || !databaseUrl || !keyValue) throw new Error('Meta rotation configuration incomplete')
const body = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: appId, client_secret: secret, fb_exchange_token: current })
const response = await fetch(`${process.env.META_GRAPH_BASE_URL ?? 'https://graph.facebook.com'}/${process.env.META_API_VERSION ?? 'v21.0'}/oauth/access_token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
if (!response.ok) throw new Error(`Token rotation failed ${response.status}`)
const rotated = await response.json() as { access_token: string; expires_in: number }
const encrypted = encryptToken(rotated.access_token, Buffer.from(keyValue, 'base64'))
const { pool } = createDatabase(databaseUrl)
try {
  await pool.query(`UPDATE accounts SET meta_access_token_encrypted=$1,meta_token_expires_at=now()+($2||' seconds')::interval WHERE role='actor'`, [encrypted, rotated.expires_in])
  await pool.query(`INSERT INTO events(scope,level,payload)VALUES('own','config_change',$1)`, [{ kind: 'meta_token_rotated', expires_in: rotated.expires_in }])
} finally { await pool.end() }
