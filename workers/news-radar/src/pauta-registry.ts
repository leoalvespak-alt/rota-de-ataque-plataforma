import { canonicalPautaKey, PAUTA_BLOCKING_STATUSES, type PautaStatus } from '@plataforma/shared'

interface Queryable {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>
}

export interface PautaSource {
  fingerprint: string | null
  url: string | null
  source_name: string | null
}

interface PautaRow {
  id: string
  status: PautaStatus
}

/**
 * Verifica o registro canônico. Retorna a linha existente (para anexar a fonte)
 * ou null quando a pauta é inédita. Pautas posted/scheduled/manual bloqueiam
 * novo finding: a notícia já está coberta.
 */
export async function checkPautaRegistry(
  client: Queryable,
  input: { categoria: string | null; estado: string | null; fase_ciclo: string | null; title: string | null },
): Promise<{ key: string; existing: PautaRow | null; blocked: boolean }> {
  const key = canonicalPautaKey(input)
  const found = await client.query<PautaRow>(
    'SELECT id, status FROM editorial.pauta_registry WHERE canonical_key = $1',
    [key],
  )
  const existing = found.rows[0] ?? null
  return {
    key,
    existing,
    blocked: existing !== null && (PAUTA_BLOCKING_STATUSES as readonly string[]).includes(existing.status),
  }
}

export async function attachPautaSource(
  client: Queryable,
  pautaId: string,
  source: PautaSource,
): Promise<void> {
  await client.query(
    `UPDATE editorial.pauta_registry
     SET sources = sources || $2::jsonb, last_seen_at = now(), updated_at = now()
     WHERE id = $1::uuid
       AND NOT (sources @> $2::jsonb)`,
    [pautaId, JSON.stringify([source])],
  )
}

export async function registerPauta(
  client: Queryable,
  input: {
    key: string
    categoria: string | null
    estado: string | null
    fase_ciclo: string | null
    title: string | null
    status: PautaStatus
    source: PautaSource
    findingId?: string | null
    opportunityId?: string | null
  },
): Promise<string> {
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO editorial.pauta_registry(canonical_key,categoria,estado,fase_ciclo,title,status,sources,finding_id,opportunity_id)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::uuid,$9::uuid)
     ON CONFLICT (canonical_key) DO UPDATE SET
       last_seen_at = now(), updated_at = now(),
       status = CASE WHEN editorial.pauta_registry.status = 'draft' THEN EXCLUDED.status ELSE editorial.pauta_registry.status END,
       finding_id = COALESCE(editorial.pauta_registry.finding_id, EXCLUDED.finding_id),
       opportunity_id = COALESCE(editorial.pauta_registry.opportunity_id, EXCLUDED.opportunity_id)
     RETURNING id`,
    [
      input.key, input.categoria, input.estado, input.fase_ciclo, input.title,
      input.status, JSON.stringify([input.source]),
      input.findingId ?? null, input.opportunityId ?? null,
    ],
  )
  const id = inserted.rows[0]?.id
  if (!id) throw new Error('Pauta registry upsert did not return an id')
  return id
}

export async function markPautaPosted(client: Queryable, pautaId: string): Promise<void> {
  await client.query(
    `UPDATE editorial.pauta_registry SET status = 'posted', last_seen_at = now(), updated_at = now() WHERE id = $1::uuid`,
    [pautaId],
  )
}
