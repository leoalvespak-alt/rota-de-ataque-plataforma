'use client'

import { ChannelTimeline, EmptyState, PageHeader, SavedViewTabs, VariantPreview } from '@plataforma/ui-bridge'
import { ContentItemActions } from './ContentItemActions'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { appPath } from '@/lib/base-path'

export function ItemDetailClient({ item, variants, assets, events }: { item: any, variants: any[], assets: any[], events: any[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'Briefing'
  const [isPending, startTransition] = useTransition()

  const tabs = ['Briefing', 'Variations', 'Assets', 'Performance', 'Lifecycle']

  function changeTab(nextTab: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab !== 'Briefing') params.set('tab', nextTab)
    else params.delete('tab')
    
    startTransition(() => {
      router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
    })
  }

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PageHeader title={item.hook} subtitle={`${item.angle} · voz ${item.brand_voice_version}`} />
      <ContentItemActions id={item.id} status={item.status} />
      
      <SavedViewTabs views={tabs} active={tab} onChange={changeTab} />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
        {tab === 'Briefing' && (
          <section className="card">
            <h2>Canônico</h2>
            <p>Status: {item.status}</p>
            <p>Tese ativa, voz definida e ao menos uma variante pronta.</p>
          </section>
        )}
        
        {tab === 'Variations' && (
          <section>
            <h2>Previews por canal</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              {variants.map((variant) => (
                <div key={variant.id} style={{ minWidth: '300px', flex: 1 }}>
                  <VariantPreview channel={variant.channel} status={variant.status} text={String(variant.payload.text ?? variant.payload.subject ?? JSON.stringify(variant.payload))} />
                </div>
              ))}
              {variants.length === 0 && <EmptyState message="Nenhuma variação criada ainda." />}
            </div>
          </section>
        )}

        {tab === 'Assets' && (
          <section>
            <h2>Assets</h2>
            {assets.length ? <div className="content-grid">{assets.map(asset => <article className="card" key={asset.id}><strong>{asset.filename ?? 'Asset sem nome'}</strong><p>{asset.mime_type ?? 'tipo não informado'}{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}</p><small>{asset.status} · {asset.source} · {new Date(asset.created_at).toLocaleString('pt-BR')}</small><code style={{overflowWrap:'anywhere'}}>{asset.storage_ref}</code>{asset.variant_id && <small>Vinculado à variante</small>}</article>)}</div> : <EmptyState message="Nenhum asset foi retornado ainda. Envie a variante para o Design System ou vincule um asset aprovado antes de agendar." />}
          </section>
        )}
        
        {tab === 'Performance' && (
          <section>
            <h2>Performance e ROI</h2>
            <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {variants.map((v) => (
                <div key={v.id} className="card">
                  <h3 style={{ textTransform: 'capitalize' }}>{v.channel.replace('_', ' ')}</h3>
                  <p>Impressões: {v.impressions ?? 0}</p>
                  <p>Engajamentos: {v.engagements ?? 0}</p>
                  <p>Conversões: {v.conversions ?? 0}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'Lifecycle' && (
          <section>
            <h2>Ciclo de Vida</h2>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <ChannelTimeline events={events.map((event) => ({ id: event.id, channel: event.channel, event: event.event_type, at: event.at }))} />
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
