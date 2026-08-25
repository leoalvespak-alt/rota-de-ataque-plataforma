import { NextResponse } from 'next/server'
import { operationalHealth, readinessHealth } from '@/lib/health'

export async function GET() {
  const [ready, operational] = await Promise.all([readinessHealth(), operationalHealth()])
  const body = { ...operational, status: ready.ok && operational.ok ? 'operational' : ready.status === 'unavailable' ? 'unavailable' : 'degraded', dependencies: ready.dependencies, operational: operational.operational }
  return NextResponse.json(body, { status: ready.ok && operational.ok ? 200 : 503, headers: { 'cache-control': 'no-store' } })
}
