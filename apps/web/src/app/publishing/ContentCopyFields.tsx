import { InputField, TextareaField } from '@plataforma/ui-bridge'

export interface ContentSlide {
  ordem?: number
  titulo?: string
  texto?: string
}

export interface ContentStory {
  ordem?: number
  texto?: string
  sticker?: string
}

export interface ContentStructure {
  copy_principal?: string
  roteiro?: string
  texto_arte?: string
  slides?: ContentSlide[]
  stories?: ContentStory[]
  legenda_longa?: string
  observacoes?: string
}

function isCarousel(format: string) {
  return format === 'carrossel' || format === 'carousel'
}

function isStatic(format: string) {
  return format === 'feed' || format === 'static' || format === 'estatico'
}

export function ContentCopyFields({
  format,
  value,
  onChange,
}: {
  format?: string | null
  value: ContentStructure | null | undefined
  onChange: (value: ContentStructure) => void
}) {
  const current = value ?? {}
  const normalizedFormat = (format ?? '').toLowerCase()
  const slides = current.slides ?? []
  const stories = current.stories ?? []
  const update = (patch: Partial<ContentStructure>) => onChange({ ...current, ...patch })

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <TextareaField
        label="Copy principal"
        description="A mensagem central da publicação, além da legenda do Instagram."
        value={current.copy_principal ?? ''}
        onChange={(event) => update({ copy_principal: event.target.value })}
        rows={6}
        maxLength={10000}
      />

      <TextareaField
        label={normalizedFormat === 'reels' ? 'Texto de fala / roteiro' : 'Roteiro ou copy longa (opcional)'}
        description={normalizedFormat === 'reels' ? 'Texto que será falado no Reel, com pausas ou indicações necessárias.' : 'Material completo para orientar a produção ou a adaptação do conteúdo.'}
        value={current.roteiro ?? ''}
        onChange={(event) => update({ roteiro: event.target.value })}
        rows={6}
        maxLength={10000}
      />

      {(normalizedFormat === 'reels' || isStatic(normalizedFormat)) && (
        <TextareaField
          label={normalizedFormat === 'reels' ? 'Texto na tela (opcional)' : 'Texto da arte / post'}
          description={normalizedFormat === 'reels' ? 'Texto que aparece sobre o vídeo.' : 'Copy que aparece na imagem ou no post visual.'}
          value={current.texto_arte ?? ''}
          onChange={(event) => update({ texto_arte: event.target.value })}
          rows={4}
          maxLength={5000}
        />
      )}

      {isCarousel(normalizedFormat) && (
        <fieldset style={{ display: 'grid', gap: 'var(--space-3)', border: 0, padding: 0, margin: 0 }}>
          <legend>Copy dos cards</legend>
          {slides.map((slide, index) => (
            <div key={index} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Card {index + 1}</strong>
                <button type="button" className="bridge-button" data-variant="quiet" onClick={() => update({ slides: slides.filter((_, itemIndex) => itemIndex !== index) })}>Remover</button>
              </div>
              <InputField label="Título do card" value={slide.titulo ?? ''} maxLength={200} onChange={(event) => { const next = [...slides]; next[index] = { ...slide, ordem: index + 1, titulo: event.target.value }; update({ slides: next }) }} />
              <TextareaField label="Texto do card" value={slide.texto ?? ''} maxLength={2000} rows={4} onChange={(event) => { const next = [...slides]; next[index] = { ...slide, ordem: index + 1, texto: event.target.value }; update({ slides: next }) }} />
            </div>
          ))}
          <button type="button" className="bridge-button" data-variant="ghost" onClick={() => update({ slides: [...slides, { ordem: slides.length + 1, titulo: '', texto: '' }] })}>+ Adicionar card</button>
        </fieldset>
      )}

      {normalizedFormat === 'stories' && (
        <fieldset style={{ display: 'grid', gap: 'var(--space-3)', border: 0, padding: 0, margin: 0 }}>
          <legend>Copy dos Stories</legend>
          {stories.map((story, index) => (
            <div key={index} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Story {index + 1}</strong>
                <button type="button" className="bridge-button" data-variant="quiet" onClick={() => update({ stories: stories.filter((_, itemIndex) => itemIndex !== index) })}>Remover</button>
              </div>
              <TextareaField label="Texto do Story" value={story.texto ?? ''} maxLength={2000} rows={4} onChange={(event) => { const next = [...stories]; next[index] = { ...story, ordem: index + 1, texto: event.target.value }; update({ stories: next }) }} />
              <InputField label="Sticker / interação (opcional)" value={story.sticker ?? ''} maxLength={200} placeholder="Enquete, caixa de pergunta, link..." onChange={(event) => { const next = [...stories]; next[index] = { ...story, ordem: index + 1, sticker: event.target.value }; update({ stories: next }) }} />
            </div>
          ))}
          <button type="button" className="bridge-button" data-variant="ghost" onClick={() => update({ stories: [...stories, { ordem: stories.length + 1, texto: '', sticker: '' }] })}>+ Adicionar Story</button>
        </fieldset>
      )}

      <TextareaField label="Legenda longa (opcional)" description="Versão completa da legenda, caso precise orientar uma adaptação posterior." value={current.legenda_longa ?? ''} onChange={(event) => update({ legenda_longa: event.target.value })} rows={4} maxLength={5000} />
      <TextareaField label="Observações para o editor (opcional)" value={current.observacoes ?? ''} onChange={(event) => update({ observacoes: event.target.value })} rows={3} maxLength={2000} />
    </div>
  )
}
