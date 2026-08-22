/**
 * GET /api/admin/automations/prerequisites
 *
 * Avalia cada PrerequisiteKey contra o banco e retorna o status de satisfação.
 * Papel mínimo: viewer.
 *
 * GARANTIA: rota nova, adicionada em paralelo. Nenhum endpoint existente é modificado.
 */

import { createDatabase } from '@plataforma/db'
import { PREREQUISITE_DEFINITIONS, type PrerequisiteKey } from '@plataforma/shared'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse } from '@/lib/api-errors'

export async function GET() {
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }

  const { pool } = createDatabase(process.env.DATABASE_URL!)

  try {
    const { rows } = await pool.query<{
      has_sources: boolean
      has_theses: boolean
      has_actor: boolean
      has_policy: boolean
      has_ai: boolean
      kill_switch: boolean
      has_approved_variant: boolean
      embeddings_ok: boolean
      has_budget: boolean
    }>(`
      SELECT
        EXISTS(SELECT 1 FROM news_sources WHERE active = true LIMIT 1)   AS has_sources,
        EXISTS(SELECT 1 FROM theses LIMIT 1)                              AS has_theses,
        EXISTS(SELECT 1 FROM accounts WHERE role = 'actor' AND status = 'HEALTHY' LIMIT 1) AS has_actor,
        EXISTS(SELECT 1 FROM contact_policies LIMIT 1)                   AS has_policy,
        COALESCE((SELECT (value->>'enabled')::boolean FROM ai_settings WHERE key = 'global' LIMIT 1), true) AS has_ai,
        COALESCE((SELECT (value->>'kill_switch')::boolean FROM operational_settings WHERE key = 'global' LIMIT 1), false) AS kill_switch,
        EXISTS(SELECT 1 FROM content_variants WHERE status = 'approved' LIMIT 1) AS has_approved_variant,
        true                                                              AS embeddings_ok,
        EXISTS(SELECT 1 FROM organic_budgets WHERE ceiling_cents > 0 LIMIT 1) AS has_budget
    `)
    const d = rows[0] ?? {
      has_sources: false, has_theses: false, has_actor: false,
      has_policy: false, has_ai: true, kill_switch: false,
      has_approved_variant: false, embeddings_ok: true, has_budget: false,
    }

    function isSatisfied(key: PrerequisiteKey): boolean {
      switch (key) {
        case 'news_source_active':        return d.has_sources
        case 'connected_account_healthy': return d.has_actor
        case 'budget_ceiling_set':        return d.has_budget
        case 'embeddings_healthy':        return d.embeddings_ok
        case 'ai_provider_configured':    return d.has_ai !== false
        case 'thesis_exists':             return d.has_theses
        case 'actor_account_healthy':     return d.has_actor
        case 'kill_switch_off':           return !d.kill_switch
        case 'approved_variant_exists':   return d.has_approved_variant
        case 'contact_policy_configured': return d.has_policy
        default:                          return true
      }
    }

    const prerequisites = PREREQUISITE_DEFINITIONS.map((def: any) => ({
      key: def.key,
      satisfied: isSatisfied(def.key),
      label_pt: def.label_pt,
      href: def.href,
    }))

    return NextResponse.json({ prerequisites })
  } finally {
    // pool não precisa de cleanup explícito (usa pg pool)
  }
}
