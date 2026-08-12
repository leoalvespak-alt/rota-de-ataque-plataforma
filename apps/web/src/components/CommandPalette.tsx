// @ts-nocheck
'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  useRegisterActions,
  useKBar,
  createAction,
  type Action
} from 'kbar'
import { helpRegistry } from '@/lib/help-registry'
import { appPath } from '@/lib/base-path'

const PAGE_ACTIONS = [
  // Visão
  { id: 'nav-overview',         name: 'Overview',                   section: 'Páginas', keywords: 'visao dashboard inicio',          href: '/' },
  // Prospecção
  { id: 'nav-leads',            name: 'Leads',                       section: 'Páginas', keywords: 'crm clientes prospectos',          href: '/leads' },
  { id: 'nav-review-inbox',     name: 'Review Inbox',                section: 'Páginas', keywords: 'revisao pendencias aprovacao',     href: '/review-inbox' },
  { id: 'nav-timeline',         name: 'Timeline',                    section: 'Páginas', keywords: 'linha do tempo historico',         href: '/timeline' },
  { id: 'nav-identities',       name: 'Identidades',                 section: 'Páginas', keywords: 'perfil merge duplicados',          href: '/identities' },
  // Inteligência
  { id: 'nav-radar',            name: 'Radar',                       section: 'Páginas', keywords: 'inteligencia social monitor',     href: '/radar' },
  { id: 'nav-market-radar',     name: 'Radar de Mercado',            section: 'Páginas', keywords: 'mercado tendencias',              href: '/market-radar' },
  { id: 'nav-competitive-intel',name: 'Inteligência Competitiva',    section: 'Páginas', keywords: 'concorrentes dores perguntas',    href: '/competitive-intel' },
  { id: 'nav-community',        name: 'Comunidades',                 section: 'Páginas', keywords: 'grupos clusters comunidade',       href: '/community' },
  // Conteúdo
  { id: 'nav-theses',           name: 'Teses',                       section: 'Páginas', keywords: 'editorial conteudo',              href: '/theses' },
  { id: 'nav-content-opportunity',name:'Oportunidades',              section: 'Páginas', keywords: 'oportunidade pauta',              href: '/content-opportunity' },
  { id: 'nav-content-items',    name: 'Conteúdos',                   section: 'Páginas', keywords: 'galeria ativos publicados',       href: '/content-items' },
  { id: 'nav-creative-bridge',  name: 'Creative Bridge',             section: 'Páginas', keywords: 'design copy arte criativa',       href: '/creative-bridge' },
  { id: 'nav-publishing',       name: 'Publicação',                  section: 'Páginas', keywords: 'agendar postar calendario',       href: '/publishing' },
  // Canais
  { id: 'nav-email-flows',      name: 'Fluxos de E-mail',            section: 'Páginas', keywords: 'email automacao sequencia',       href: '/email-flows' },
  { id: 'nav-communities',      name: 'Grupos WhatsApp',             section: 'Páginas', keywords: 'whatsapp grupos comunidades',     href: '/communities' },
  { id: 'nav-conversations',    name: 'Conversas',                   section: 'Páginas', keywords: 'mensagens chat inbox',            href: '/conversations' },
  // Governança
  { id: 'nav-contact-policies', name: 'Políticas de Contato',        section: 'Páginas', keywords: 'politica limites cadencia spam',  href: '/contact-policies' },
  { id: 'nav-engagement-queue', name: 'Fila de Engagement',          section: 'Páginas', keywords: 'fila engajamento acoes curtidas', href: '/engagement-queue' },
  // Sistema
  { id: 'nav-accounts',         name: 'Contas e Integrações',        section: 'Páginas', keywords: 'contas meta instagram oauth',     href: '/accounts' },
  { id: 'nav-ai-settings',      name: 'Modelos de IA',               section: 'Páginas', keywords: 'ia llm modelos deepseek',        href: '/ai-settings' },
  { id: 'nav-configs',          name: 'Configurações',               section: 'Páginas', keywords: 'config score parametros',        href: '/configs' },
  { id: 'nav-source-roi',       name: 'ROI por Origem',              section: 'Páginas', keywords: 'roi origem analytics',            href: '/source-roi' },
  { id: 'nav-notifications',    name: 'Notificações',                section: 'Páginas', keywords: 'alertas notificacoes erros',      href: '/notifications' },
  { id: 'nav-system-health',    name: 'Saúde do Sistema',            section: 'Páginas', keywords: 'saude sistema health workers',    href: '/system-health' },
  // Ações rápidas
  { id: 'action-create-thesis',      name: 'Criar Tese',             section: 'Ações', keywords: 'nova tese', shortcut: ['c','t'],   href: '/theses?action=create' },
  { id: 'action-create-opportunity', name: 'Criar Oportunidade',     section: 'Ações', keywords: 'nova oportunidade', shortcut: ['c','o'], href: '/content-opportunity?action=create' },
  { id: 'action-open-queue',         name: 'Abrir Fila de Engagement',section: 'Ações', keywords: 'fila engajamento', shortcut: ['g','q'], href: '/engagement-queue' },
  { id: 'action-pause-system',       name: 'Pausar Sistema',         section: 'Ações', keywords: 'killswitch emergencia pare',      href: '/system-health?action=killswitch' },
]

function DynamicProviders() {
  const router = useRouter()

  // Help provider — all help-registry entries as actions
  const helpActions: Action[] = Object.entries(helpRegistry).map(([route, help]) => ({
    id: `help-${route}`,
    name: `Ajuda: ${help.title}`,
    section: 'Ajuda',
    keywords: `ajuda help ${help.title} ${route}`,
    perform: () => { router.push(`${route}?help=1`) }
  }))

  useRegisterActions(helpActions, [router])

  return (
    <>
      <LeadsProvider />
    </>
  )
}

function LeadsProvider() {
  const router = useRouter()
  const { search, rootActionId } = useKBar(state => ({ search: state.searchQuery, rootActionId: state.currentRootActionId }))
  const [results, setResults] = React.useState<Action[]>([])

  const parent = React.useMemo<Action>(() => ({
    id: 'search-leads',
    name: 'Buscar lead...',
    shortcut: ['s', 'l'],
    keywords: 'buscar lead procurar',
    section: 'Ações'
  }), [])

  useRegisterActions([parent], [parent])

  useEffect(() => {
    if (rootActionId !== 'search-leads' || !search || search.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(search)}`)
        if (res.ok) {
          const body = await res.json() as { items: any[] }
          setResults(body.items.map(item => ({
            id: `lead-${item.id}`,
            name: `@${item.username_current}`,
            parent: 'search-leads',
            perform: () => router.push(`/leads?search=${item.username_current}`)
          })))
        }
      } catch (err) {}
    }, 300)
    return () => clearTimeout(timer)
  }, [search, rootActionId, router])

  useRegisterActions(results, [results])

  return null
}

export function CommandPalette({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const staticActions = PAGE_ACTIONS.map(a => createAction({
    id: a.id,
    name: a.name,
    section: a.section,
    keywords: a.keywords,
    shortcut: (a as any).shortcut ?? [],
    perform: () => router.push(a.href),
  }))

  return (
    <KBarProvider actions={staticActions}>
      <KBarPortal>
        <KBarPositioner className="command-backdrop">
          <KBarAnimator className="command-palette">
            <KBarSearch className="bridge-input" style={{ width: '100%', marginBottom: '10px' }} defaultPlaceholder="Busque uma página, lead, ajuda ou ação..." />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      <DynamicProviders />
      {children}
    </KBarProvider>
  )
}

function RenderResults() {
  const { results } = useMatches()

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
            {item}
          </div>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              background: active ? 'var(--surface-subtle)' : 'transparent',
              borderLeft: `2px solid ${active ? 'var(--accent-primary)' : 'transparent'}`,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
              {item.subtitle && <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '12px' }}>{item.subtitle}</span>}
            </div>
            {item.shortcut?.length ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                {item.shortcut.map(key => (
                  <kbd key={key} style={{ padding: '2px 6px', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '4px', fontSize: '12px' }}>{key}</kbd>
                ))}
              </div>
            ) : null}
          </div>
        )
      }
    />
  )
}
