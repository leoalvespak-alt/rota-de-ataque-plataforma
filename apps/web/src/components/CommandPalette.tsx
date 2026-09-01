'use client'

import React from 'react'
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
  type Action
} from 'kbar'
import { helpRegistry } from '@/lib/help-registry'
import { NAVIGATION, navigationHref } from '@/lib/navigation'

const QUICK_ACTIONS = [
  { id: 'action-create-thesis', name: 'Criar Tese', keywords: 'nova tese', shortcut: ['c', 't'], href: '/planejamento/teses?action=create' },
  { id: 'action-create-opportunity', name: 'Criar Oportunidade', keywords: 'nova oportunidade', shortcut: ['c', 'o'], href: '/planejamento/oportunidades?action=create' },
  { id: 'action-open-queue', name: 'Abrir fila de decisões', keywords: 'fila revisão editorial', shortcut: ['g', 'q'], href: '/decisoes' },
  { id: 'action-open-system', name: 'Abrir prontidão do sistema', keywords: 'sistema incidentes canário', shortcut: ['g', 's'], href: '/sistema' },
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

  return null
}

export function CommandPalette({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const staticActions: Action[] = [
    ...NAVIGATION.flatMap((destination) => destination.tabs.map((tab) => ({
      id: `nav-${destination.id}-${tab.id}`,
      name: `${destination.title} · ${tab.label_pt}`,
      section: 'Páginas',
      keywords: `${destination.title} ${tab.label_pt} ${'legacyPath' in tab ? tab.legacyPath : ''}`,
      perform: () => {
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
            <KBarSearch className="bridge-input" style={{ width: '100%', marginBottom: '10px' }} defaultPlaceholder="Busque uma página, ajuda ou ação..." />
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
