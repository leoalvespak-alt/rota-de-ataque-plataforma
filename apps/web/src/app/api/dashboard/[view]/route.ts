import { NextResponse } from 'next/server'
import { DashboardViewSchema, loadDashboardView } from '@/lib/dashboard-data'
import { apiErrorResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

export async function GET(_request: Request, { params }: { params: Promise<{ view: string }> }) {
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }
  try {
    const view = DashboardViewSchema.safeParse((await params).view)
    if (!view.success) return NextResponse.json({ error: 'unknown_view' }, { status: 404 })
    const result = await loadDashboardView(view.data)
    return NextResponse.json({ data: result.items, items: result.items, meta: { requestId: crypto.randomUUID(), campaignId: result.campaign?.id ?? null, generatedAt: result.generatedAt, freshness: 'live', sourceStatus: 'ready' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
