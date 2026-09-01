import { TextareaField } from '@plataforma/ui-bridge'

export interface ContentSlide { ordem?: number; titulo?: string; texto?: string }
export interface ContentStory { ordem?: number; texto?: string; sticker?: string }
export interface ContentStructure {
  copy_principal?: string
  roteiro?: string
  texto_arte?: string
  slides?: ContentSlide[]
  stories?: ContentStory[]
  legenda_longa?: string
  observacoes?: string
}

export function ContentCopyFields({ value, onChange }: { format?: string | null; value: ContentStructure | null | undefined; onChange: (value: ContentStructure) => void }) {
  const current = value ?? {}
  const update = (patch: Partial<ContentStructure>) => onChange({ ...current, ...patch })
  return <div style={{ display: 'grid', gap: '12px' }}>
    <TextareaField label="Copy principal" value={current.copy_principal ?? ''} onChange={(event) => update({ copy_principal: event.target.value })} rows={6} maxLength={10000} />
    <TextareaField label="Roteiro ou copy longa" value={current.roteiro ?? ''} onChange={(event) => update({ roteiro: event.target.value })} rows={6} maxLength={10000} />
    <TextareaField label="Texto da arte" value={current.texto_arte ?? ''} onChange={(event) => update({ texto_arte: event.target.value })} rows={4} maxLength={5000} />
    <TextareaField label="Observações para o editor" value={current.observacoes ?? ''} onChange={(event) => update({ observacoes: event.target.value })} rows={3} maxLength={2000} />
  </div>
}
