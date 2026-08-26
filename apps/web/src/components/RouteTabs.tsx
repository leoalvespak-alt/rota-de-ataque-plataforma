'use client'

'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'
import { NAVIGATION, navigationHref, type NavigationDestination } from '@/lib/navigation'
import { TabArrowButtons } from '@plataforma/ui-bridge'

export function RouteTabs({ destinationId, activeTab, children }: { destinationId: NavigationDestination['id']; activeTab: string; children: ReactNode }) {
  const destination = NAVIGATION.find((item) => item.id === destinationId)
  const refs = useRef<Array<HTMLAnchorElement | null>>([])
  if (!destination) throw new Error(`Destino de navegação desconhecido: ${destinationId}`)

  const visibleTabs = destination.tabs
  const activeIndex = Math.max(0, visibleTabs.findIndex((tab) => tab.id === activeTab))
  const previousTab = visibleTabs[activeIndex - 1]
  const nextTab = visibleTabs[activeIndex + 1]
  return <div className="bridge-page-content">
    <header className="bridge-page-header">
      <div><p className="eyebrow">Rota de Ataque</p><h1>{destination.title}</h1></div>
    </header>
    {visibleTabs.length > 1 && <div className="bridge-tab-navigation"><TabArrowButtons previous={previousTab ? { label: previousTab.label_pt, href: navigationHref(destination, previousTab) } : undefined} next={nextTab ? { label: nextTab.label_pt, href: navigationHref(destination, nextTab) } : undefined} /><nav role="tablist" aria-label={`Abas de ${destination.title}`} className="bridge-tabs">
      {visibleTabs.map((tab, index) => <Link
        key={tab.id}
        ref={(element) => { refs.current[index] = element }}
        role="tab"
        id={`${destination.id}-tab-${tab.id}`}
        aria-selected={tab.id === activeTab}
        aria-controls={`${destination.id}-panel-${tab.id}`}
        tabIndex={tab.id === activeTab ? 0 : -1}
        href={navigationHref(destination, tab)}
        onKeyDown={(event) => {
          const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
          if (!delta) return
          event.preventDefault()
          refs.current[(index + delta + visibleTabs.length) % visibleTabs.length]?.focus()
        }}
      >{tab.label_pt}</Link>)}
    </nav></div>}
    <section id={`${destination.id}-panel-${activeTab}`} role="tabpanel" aria-labelledby={`${destination.id}-tab-${activeTab}`}>
      {children}
    </section>
  </div>
}
