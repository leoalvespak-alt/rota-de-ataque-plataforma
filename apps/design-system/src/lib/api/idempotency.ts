/** Stable, non-secret request key; the server independently hashes the complete payload. */
export function createIdempotencyKey(scope: string, ...parts: Array<string | null | undefined>): string {
  const input = parts.join('\u001f')
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${scope}:${(hash >>> 0).toString(16).padStart(8, '0')}`
}
