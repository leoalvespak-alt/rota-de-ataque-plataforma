import { NextResponse } from 'next/server'
import { liveHealth } from '@/lib/health'

export async function GET() {
  return NextResponse.json(liveHealth(), { status: 200, headers: { 'cache-control': 'no-store' } })
}
