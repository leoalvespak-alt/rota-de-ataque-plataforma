import { NextResponse } from 'next/server'
import { readinessHealth } from '@/lib/health'

export async function GET() {
  const result = await readinessHealth()
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers: { 'cache-control': 'no-store' } })
}
