import { NextResponse } from 'next/server'
import { operationalHealth } from '@/lib/health'

export async function GET() {
  const result = await operationalHealth()
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers: { 'cache-control': 'no-store' } })
}
