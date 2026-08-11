import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/permissions'
import { signMetaState, type MetaAccountRole } from '@/lib/metaOAuth'

export async function GET(request: Request) {
  await requireRole('admin')
  const role = new URL(request.url).searchParams.get('role') as MetaAccountRole | null
  if (role !== 'collector' && role !== 'actor') return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  const appId = process.env.META_APP_ID
  const secret = process.env.META_APP_SECRET
  const appUrl = process.env.APP_URL
  if (!appId || !secret || !appUrl) return NextResponse.json({ error: 'meta_oauth_not_configured' }, { status: 503 })
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', `${appUrl}/api/meta/oauth/callback`)
  url.searchParams.set('state', signMetaState(role, secret))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', ['pages_show_list', 'pages_manage_metadata', 'business_management', 'instagram_basic', 'instagram_manage_insights', 'instagram_manage_comments', 'instagram_manage_messages', 'instagram_content_publish'].join(','))
  return NextResponse.redirect(url)
}
