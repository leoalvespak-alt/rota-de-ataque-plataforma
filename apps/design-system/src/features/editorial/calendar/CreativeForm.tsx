import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'

export type CreativeFormData = {
  id?: string
  title: string
  caption: string
  channel: string
  format: string
  status: string
  scheduled_for: string
  thesis_id: string
}

const CHANNELS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'threads', label: 'Threads' },
  { value: 'feed', label: 'Feed' },
  { value: 'stories', label: 'Stories' },
]

const FORMATS = [
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'reels', label: 'Reels' },
  { value: 'static', label: 'Estático' },
  { value: 'stories', label: 'Stories' },
]

const STATUSES = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'planned', label: 'Planejado' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'ready', label: 'Pronto' },
  { value: 'published', label: 'Publicado' }
]

export function CreativeForm({ 
  initialData, 
  onSave, 
  onCancel 
}: { 
  initialData?: Partial<CreativeFormData>
  onSave: () => void
  onCancel: () => void 
}) {
  const [data, setData] = useState<CreativeFormData>({
    title: initialData?.title ?? '',
    caption: initialData?.caption ?? '',
    channel: initialData?.channel ?? 'instagram',
    format: initialData?.format ?? 'carrossel',
    status: initialData?.status ?? 'draft',
    scheduled_for: initialData?.scheduled_for ? new Date(initialData.scheduled_for).toISOString().slice(0, 16) : '',
    thesis_id: initialData?.thesis_id ?? ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const payload = {
        ...data,
        scheduled_for: data.scheduled_for ? new Date(data.scheduled_for).toISOString() : null,
        thesis_id: data.thesis_id || null
      }
      
      if (initialData?.id) {
        await apiFetch(`/publications/${initialData.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        })
      } else {
        await apiFetch('/publications', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }
      onSave()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar criativo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ui-text">Título</label>
        <input 
          required
          type="text" 
          value={data.title}
          onChange={e => setData({...data, title: e.target.value})}
          className="w-full rounded-md border border-ui-border bg-ui-panel p-2 text-ui-text"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ui-text">Canal</label>
          <select 
            value={data.channel}
            onChange={e => setData({...data, channel: e.target.value})}
            className="w-full rounded-md border border-ui-border bg-ui-panel p-2 text-ui-text"
          >
            {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ui-text">Formato</label>
          <select
            value={data.format}
            onChange={e => setData({...data, format: e.target.value})}
            className="w-full rounded-md border border-ui-border bg-ui-panel p-2 text-ui-text"
          >
            {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ui-text">Status</label>
          <select 
            value={data.status}
            onChange={e => setData({...data, status: e.target.value})}
            className="w-full rounded-md border border-ui-border bg-ui-panel p-2 text-ui-text"
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ui-text">Agendamento</label>
          <input 
            type="datetime-local"
            value={data.scheduled_for}
            onChange={e => setData({...data, scheduled_for: e.target.value})}
            className="w-full rounded-md border border-ui-border bg-ui-panel p-2 text-ui-text"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-ui-text">Legenda</label>
        <textarea 
          rows={3}
          value={data.caption}
          onChange={e => setData({...data, caption: e.target.value})}
          className="w-full rounded-md border border-ui-border bg-ui-panel p-2 text-ui-text"
        />
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}
      
      <div className="flex justify-end gap-3 pt-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="rounded-md border border-ui-border px-4 py-2 text-sm text-ui-text hover:bg-ui-panel2"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="rounded-md bg-ui-primary px-4 py-2 text-sm text-ui-panel hover:bg-ui-primary/90 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Criativo'}
        </button>
      </div>
    </form>
  )
}
