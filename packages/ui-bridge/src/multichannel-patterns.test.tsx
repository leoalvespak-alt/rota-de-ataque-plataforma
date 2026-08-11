import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChannelBadge, ContactPolicyIndicator, FlowCanvas, GroupPolicyForm, IdentityStrip, MarketSignalCard, VariantPreview } from './patterns.js'

describe('multichannel UI patterns', () => {
  it('renders channel semantics without inaccessible controls', () => {
    const markup = renderToStaticMarkup(<main><ChannelBadge channel="threads"/><VariantPreview channel="email" text="Olá"/><MarketSignalCard label="Dúvida" kind="question" velocity={4} evidenceCount={2}/><IdentityStrip identities={[{channel:'instagram',handle:'@rota',verified:true}]}/><ContactPolicyIndicator allowed={false} reason="cadence"/><FlowCanvas nodes={[{id:'entry',type:'Entry',label:'Entrada'}]}/><GroupPolicyForm/></main>)
    expect(markup).toContain('aria-label="Fluxo de e-mail"'); expect(markup).toContain('Contato bloqueado'); expect(markup).toContain('disabled')
  })
})
