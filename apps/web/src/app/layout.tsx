import type { Metadata } from 'next'
import { createDatabase } from '@plataforma/db'
import { AppShell } from '@/components/AppShell'
import { getCampaignContext } from '@/lib/campaign-context'
import './globals.css'

export const metadata: Metadata = { title: 'Plataforma Rota de Ataque', description: 'Gestão de redes sociais e prospecção ativa' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let context: Awaited<ReturnType<typeof getCampaignContext>> = { campaigns: [], selected: null }
  if (process.env.DATABASE_URL) {
    const { pool } = createDatabase(process.env.DATABASE_URL)
    try { context = await getCampaignContext(pool) } catch { context = { campaigns: [], selected: null } } finally { await pool.end() }
  }
  return <html lang="pt-BR"><body><a className="skip" href="#content">Pular para o conteúdo</a><AppShell campaigns={context.campaigns} selectedCampaignId={context.selected?.id ?? null}>{children}</AppShell></body></html>
}
