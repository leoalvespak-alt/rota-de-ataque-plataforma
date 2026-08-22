import { createHash } from 'node:crypto'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function migrationChecksums(sql: string): {
  canonical: string
  acceptedLegacy: Set<string>
} {
  const normalized = sql.replace(/\r\n?/g, '\n')
  const crlf = normalized.replace(/\n/g, '\r\n')

  return {
    canonical: sha256(normalized),
    acceptedLegacy: new Set([sha256(sql), sha256(crlf)]),
  }
}
