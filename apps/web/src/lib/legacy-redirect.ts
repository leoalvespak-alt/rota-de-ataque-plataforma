import { permanentRedirect } from 'next/navigation'

type LegacySearchParams = Promise<Record<string, string | string[] | undefined>>

export async function permanentLegacyRedirect(target: string, tab: string, searchParams?: LegacySearchParams): Promise<never> {
  const params = new URLSearchParams()
  if (searchParams) {
    for (const [key, raw] of Object.entries(await searchParams)) {
      for (const value of Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]) params.append(key, value)
    }
  }
  params.set('aba', tab)
  permanentRedirect(`${target}?${params.toString()}`)
}
