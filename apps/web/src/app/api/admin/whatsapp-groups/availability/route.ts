import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/permissions'

export async function GET() {
  await requireRole('viewer')
  const checkedAt = new Date().toISOString()
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const missing = [!businessAccountId && 'WHATSAPP_BUSINESS_ACCOUNT_ID', !accessToken && 'WHATSAPP_ACCESS_TOKEN'].filter(Boolean)
  if (missing.length) return NextResponse.json({ available: false, checked: false, reason: 'missing_credentials', missing, checkedAt })

  const version = process.env.META_API_VERSION ?? 'v21.0'
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${businessAccountId}?fields=id,name`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const body = await response.json() as { name?: string }
    return NextResponse.json({
      available: response.ok && process.env.WHATSAPP_GROUPS_AVAILABLE === 'true',
      checked: true,
      checkedAt,
      apiVersion: version,
      providerStatus: response.status,
      accountName: response.ok ? body.name : undefined,
      reason: response.ok ? (process.env.WHATSAPP_GROUPS_AVAILABLE === 'true' ? 'available' : 'feature_flag_disabled') : 'provider_rejected',
    })
  } catch {
    return NextResponse.json({ available: false, checked: true, checkedAt, reason: 'provider_unreachable' }, { status: 503 })
  }
}
