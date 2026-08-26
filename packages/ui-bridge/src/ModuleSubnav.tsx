'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { TabArrowButtons } from './TabNavigation'

export function ModuleSubnav({ items, current }: { items: Array<{ label: string; href: string }>; current?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const location = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const currentIndex = Math.max(0, items.findIndex((item) => item.href === (current ?? location) || (item.href.split('?')[0] === pathname && !item.href.includes('?'))))
  const previous = items[currentIndex - 1]
  const next = items[currentIndex + 1]
  return <div className="bridge-tab-navigation"><TabArrowButtons previous={previous} next={next} /><nav className="bridge-tabs" aria-label="Seções do módulo">{items.map((item) => <Link href={item.href} aria-current={(current ?? location) === item.href ? 'page' : undefined} key={item.href}>{item.label}</Link>)}</nav></div>
}
