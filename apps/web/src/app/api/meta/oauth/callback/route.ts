import { NextResponse } from 'next/server'
import { createDatabase, encryptToken } from '@plataforma/db'
import { verifyMetaState } from '@/lib/metaOAuth'

interface TokenResponse { access_token?: string; expires_in?: number; error?: { message?: string } }
interface PageAccount { id: string; name?: string; access_token?: string; instagram_business_account?: { id: string; username?: string } }

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  const appUrl = process.env.APP_URL
  const databaseUrl = process.env.DATABASE_URL
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY
  if (!code || !state || !appId || !appSecret || !appUrl || !databaseUrl || !encryptionKey) return NextResponse.redirect(`${appUrl ?? ''}/accounts?meta=error`)
  try {
    const role = verifyMetaState(state, appSecret)
    const redirectUri = `${appUrl}/api/meta/oauth/callback`
    const shortUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    shortUrl.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString()
    const short = await fetch(shortUrl).then((response) => response.json() as Promise<TokenResponse>)
    if (!short.access_token) throw new Error(short.error?.message ?? 'Meta short-lived token missing')
    const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
    longUrl.search = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token }).toString()
    const long = await fetch(longUrl).then((response) => response.json() as Promise<TokenResponse>)
    const userToken = long.access_token ?? short.access_token
    const pagesUrl = new URL('https://graph.facebook.com/v21.0/me/accounts')
    pagesUrl.search = new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: userToken }).toString()
    const pages = await fetch(pagesUrl).then((response) => response.json() as Promise<{ data?: PageAccount[] }>)
    const page = pages.data?.find((item) => item.instagram_business_account?.id && item.access_token)
    if (!page?.instagram_business_account?.id || !page.access_token) throw new Error('No connected Instagram Business account found')
    const key = Buffer.from(encryptionKey, 'base64')
    const { pool } = createDatabase(databaseUrl)
    try {
      const username = page.instagram_business_account.username ?? `ig_${page.instagram_business_account.id}`
      const result = await pool.query<{ id: string }>(`UPDATE accounts SET username=$1,status='HEALTHY',meta_ig_user_id=$2,meta_page_id=$3,meta_access_token_encrypted=$4,meta_token_expires_at=now()+($5 || ' seconds')::interval,api_capabilities=$6 WHERE id=(SELECT id FROM accounts WHERE role=$7 AND status='AUTH_REQUIRED' ORDER BY id LIMIT 1) RETURNING id`, [username, page.instagram_business_account.id, page.id, encryptToken(page.access_token, key), long.expires_in ?? short.expires_in ?? 5_184_000, JSON.stringify({ oauth: true, pages: true, insights: true, comments: true, messages: true, publishing: true }), role])
      if (!result.rowCount) await pool.query(`INSERT INTO accounts(username,role,status,meta_ig_user_id,meta_page_id,meta_access_token_encrypted,meta_token_expires_at,api_capabilities) VALUES($1,$2,'HEALTHY',$3,$4,$5,now()+($6 || ' seconds')::interval,$7)`, [username, role, page.instagram_business_account.id, page.id, encryptToken(page.access_token, key), long.expires_in ?? short.expires_in ?? 5_184_000, JSON.stringify({ oauth: true, pages: true, insights: true, comments: true, messages: true, publishing: true })])
      await pool.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES('meta-oauth','account.link',$1,$2)`, [result.rows[0]?.id ?? username, JSON.stringify({ role, username, pageId: page.id, igUserId: page.instagram_business_account.id })])
    } finally {}
    return NextResponse.redirect(`${appUrl}/accounts?meta=linked&role=${role}`)
  } catch (error) {
    console.error('Meta OAuth callback failed', error instanceof Error ? error.message : error)
    return NextResponse.redirect(`${appUrl}/accounts?meta=error`)
  }
}
