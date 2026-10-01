/**
 * pauta-key.ts
 * Chave canônica de pauta: identifica a MESMA notícia através de fontes e
 * URLs diferentes. Formato legível (sem hash) para ser computável em
 * qualquer runtime: `categoria|uf|fase|titulo-normalizado`.
 */
export interface PautaKeyInput {
  categoria: string | null | undefined
  estado: string | null | undefined
  fase_ciclo: string | null | undefined
  title: string | null | undefined
}

export function normalizePautaTitle(title: string | null | undefined): string {
  return (title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 200)
}

export function canonicalPautaKey(input: PautaKeyInput): string {
  const categoria = (input.categoria ?? 'outro').trim().toLowerCase() || 'outro'
  const estado = (input.estado ?? '').trim().toUpperCase() || 'BR'
  const fase = (input.fase_ciclo ?? '').trim().toLowerCase() || 'none'
  return `${categoria}|${estado}|${fase}|${normalizePautaTitle(input.title)}`
}

/** Estados em que uma pauta bloqueia nova publicação automática. */
export const PAUTA_BLOCKING_STATUSES = ['posted', 'scheduled', 'manual'] as const
export type PautaStatus = 'draft' | 'scheduled' | 'posted' | 'manual'
