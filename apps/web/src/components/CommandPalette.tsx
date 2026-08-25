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
  type Action
} from 'kbar'
import { helpRegistry } from '@/lib/help-registry'
import { NAVIGATION, navigationHref } from '@/lib/navigation'
import { useUiMode } from './UiModeProvider'
import { appPath } from '@/lib/base-path'

const QUICK_ACTIONS = [
  { id: 'action-create-thesis', name: 'Criar Tese', keywords: 'nova tese', shortcut: ['c', 't'], href: '/conteudo?aba=teses&action=create' },
  { id: 'action-create-opportunity', name: 'Criar Oportunidade', keywords: 'nova oportunidade', shortcut: ['c', 'o'], href: '/conteudo?aba=oportunidades&action=create' },
  { id: 'action-open-queue', name: 'Abrir Fila de Engagement', keywords: 'fila engajamento', shortcut: ['g', 'q'], href: '/decisoes?aba=engajamento' },
  { id: 'action-pause-system', name: 'Pausar Sistema', keywords: 'killswitch emergência pare', href: '/automacoes?aba=saude&action=killswitch' },
] as const

function DynamicProviders() {
  const router = useRouter()

  // Help provider — all help-registry entries as actions
  const helpActions: Action[] = Object.entries(helpRegistry).map(([route, help]) => ({
    id: `help-${route}`,
    name: `Ajuda: ${help.title}`,
    section: 'Ajuda',
    keywords: `ajuda help ${help.title} ${route}`,
    perform: () => { router.push(`${route}${route.includes('?') ? '&' : '?'}help=1`) }
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
        const res = await fetch(`${appPath('/api/leads')}?limit=100`)
        if (res.ok) {
          const body = await res.json() as { items: any[] }
          setResults(body.items.filter((item) => String(item.username_current).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).slice(0, 20).map(item => ({
            id: `lead-${item.id}`,
            name: `@${item.username_current}`,
            parent: 'search-leads',
            perform: () => router.push(`/relacionamento?aba=leads&search=${encodeURIComponent(item.username_current)}`)
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
  const { revealAdvanced } = useUiMode()

  const staticActions: Action[] = [
    ...NAVIGATION.flatMap((destination) => destination.tabs.map((tab) => ({
      id: `nav-${destination.id}-${tab.id}`,
      name: `${destination.title} · ${tab.label_pt}`,
      section: 'Páginas',
      keywords: `${destination.title} ${tab.label_pt} ${'legacyPath' in tab ? tab.legacyPath : ''}`,
      perform: () => {
        if (tab.tier === 'advanced') revealAdvanced()
        router.push(navigationHref(destination, tab))
      },
    }))),
    ...QUICK_ACTIONS.map((action) => ({
      id: action.id,
      name: action.name,
      section: 'Ações',
      keywords: action.keywords,
      shortcut: 'shortcut' in action ? [...action.shortcut] : undefined,
      perform: () => router.push(action.href),
    })),
  ]

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
