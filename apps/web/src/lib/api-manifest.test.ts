import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { API_ROUTE_MANIFEST } from './api-manifest'

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return routeFiles(absolute)
    return entry.name === 'route.ts' ? [absolute] : []
  })
}

function routePattern(file: string) {
  const normalized = file.replaceAll(String.fromCharCode(92), '/')
  const rel = normalized.slice(normalized.indexOf('/app/api') + 4).replaceAll('/route.ts', '')
  return rel.split('/').map((part) => part.startsWith('[...') ? ':' + part.slice(4, -1) + '*' : part.startsWith('[') ? ':' + part.slice(1, -1) : part).join('/')
}

function routeMethods(file: string) {
  const source = readFileSync(file, 'utf8')
  const matches = [
    ...source.matchAll(/export async function\s+(GET|POST|PUT|PATCH|DELETE)/gu),
    ...source.matchAll(/\bas\s+(GET|POST|PUT|PATCH|DELETE)/gu),
  ]
  return [...new Set(matches.map((match) => match[1]))].sort()
}

describe('API manifest', () => {
  it('covers every route handler exactly once', () => {
    const appApi = path.resolve(import.meta.dirname, '..', 'app/api')
    const files = routeFiles(appApi)
    const discovered = files.map(routePattern).sort()
    const declared = API_ROUTE_MANIFEST.map((entry) => entry.path).sort()
    expect(declared).toHaveLength(discovered.length)
    expect(new Set(declared).size).toBe(declared.length)
    expect(declared).toEqual(discovered)

    const declaredMethods = new Map(API_ROUTE_MANIFEST.map((entry) => [entry.path, [...entry.methods].sort()]))
    for (const file of files) expect(declaredMethods.get(routePattern(file) as (typeof API_ROUTE_MANIFEST)[number]['path'])).toEqual(routeMethods(file))
  })

  it('does not expose non-health business routes anonymously', () => {
    expect(API_ROUTE_MANIFEST.filter((entry) => entry.auth === 'public').every((entry) => entry.path.startsWith('/api/health') || entry.path.startsWith('/api/auth') || entry.path.includes('/webhook') || entry.path.includes('/confirm') || entry.path.includes('/subscribe') || entry.path.includes('/optin') || entry.path.includes('/oauth/callback'))).toBe(true)
  })
})
