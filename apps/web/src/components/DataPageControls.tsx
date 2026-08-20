'use client'

import Link from 'next/link'

export function DataPageControls({ page, hasNext, from, to }: { page: number; hasNext: boolean; from: string | null; to: string | null }) {
  const query = (nextPage: number) => {
    const params = new URLSearchParams()
    params.set('page', String(nextPage))
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return `?${params.toString()}`
  }
  return <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 'var(--space-4)', margin: 'var(--space-4) 0' }}><form method="get" style={{ display: 'flex', alignItems: 'end', gap: 'var(--space-2)', flexWrap: 'wrap' }}><label>De<input name="from" type="date" defaultValue={from ?? ''} /></label><label>Até<input name="to" type="date" defaultValue={to ?? ''} /></label><button className="bridge-button" data-variant="secondary" type="submit">Filtrar</button></form><nav aria-label="Paginação" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>{page > 1 ? <Link className="bridge-button" data-variant="quiet" href={query(page - 1)}>Anterior</Link> : <button className="bridge-button" data-variant="quiet" disabled>Anterior</button>}<span>Página {page}</span>{hasNext ? <Link className="bridge-button" data-variant="quiet" href={query(page + 1)}>Próxima</Link> : <button className="bridge-button" data-variant="quiet" disabled>Próxima</button>}</nav></div>
}
