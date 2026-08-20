'use client'
import { PageHeader, EmptyState, StatusBadge } from '@plataforma/ui-bridge'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { appPath } from '@/lib/base-path'

export function RunbooksClient({ runbooks }: { runbooks: any[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.get('search') || ''
  
  function setSearch(val: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set('search', val)
    else params.delete('search')
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }
  const visible = runbooks.filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
  
  return (
    <main className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Runbooks Operacionais" subtitle="Guias de resolução de incidentes" />
      <div style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
        <input 
          type="search" 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar runbook por título ou tag..." 
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visible.length > 0 ? (
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {visible.map(r => (
              <a key={r.slug} href={appPath(`/docs/runbooks/${r.slug}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <article className="card" style={{ height: '100%', cursor: 'pointer', transition: 'box-shadow 0.2s', border: '1px solid var(--border)' }}>
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{r.title}</h3>
                    <StatusBadge status={r.status} />
                  </header>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {r.tags.map((t: string) => (
                      <span key={t} style={{ background: 'var(--surface-overlay)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{t}</span>
                    ))}
                  </div>
                </article>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState message="Nenhum runbook encontrado." />
        )}
      </div>
    </main>
  )
}
