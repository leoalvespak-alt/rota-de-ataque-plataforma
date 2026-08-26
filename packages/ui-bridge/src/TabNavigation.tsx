'use client'

import Link from 'next/link'

export type TabArrowTarget = {
  label: string
  href?: string
  onSelect?: () => void
}

function ArrowControl({ target, direction }: { target?: TabArrowTarget; direction: 'previous' | 'next' }) {
  const symbol = direction === 'previous' ? '←' : '→'
  const label = target ? `${direction === 'previous' ? 'Aba anterior' : 'Próxima aba'}: ${target.label}` : direction === 'previous' ? 'Primeira aba' : 'Última aba'
  if (target?.href) return <Link className="bridge-tab-arrow" href={target.href} aria-label={label} title={label}>{symbol}</Link>
  return <button type="button" className="bridge-tab-arrow" aria-label={label} title={label} disabled={!target} onClick={target?.onSelect}>{symbol}</button>
}

export function TabArrowButtons({ previous, next }: { previous?: TabArrowTarget; next?: TabArrowTarget }) {
  return <div className="bridge-tab-arrows" aria-label="Navegação entre abas"><ArrowControl target={previous} direction="previous" /><ArrowControl target={next} direction="next" /></div>
}
