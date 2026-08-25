import { permanentLegacyRedirect } from '@/lib/legacy-redirect'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { await permanentLegacyRedirect('/automacoes', 'ia', searchParams) }
