import { permanentLegacyRedirect } from '@/lib/legacy-redirect'

export default async function LegacyPerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await permanentLegacyRedirect('/performance', 'conteudo', searchParams)
}
