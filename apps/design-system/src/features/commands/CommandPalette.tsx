import { useEffect, useMemo, useState } from 'react'
import { Command, Search } from 'lucide-react'
import type { AppTab } from '@/stores/useUiStore'
import { useFeatureFlags } from '@/domain/featureFlags'

interface Props { onTab: (tab: AppTab) => void; onSave: () => void; onExport: () => void }
const tabs: { id: AppTab; title: string }[] = [
  { id: 'create', title: 'Abrir Criar arte' }, { id: 'brand', title: 'Abrir Marca' }, { id: 'ai-config', title: 'Abrir IA' }, { id: 'renders', title: 'Abrir Renders' }, { id: 'history', title: 'Abrir Histórico' },
]

export function CommandPalette({ onTab, onSave, onExport }: Props) {
  const enabled = useFeatureFlags((state) => state.flags['command-center'])
  const [open, setOpen] = useState(false); const [query, setQuery] = useState('')
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen((value) => !value) } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [])
  const items = useMemo(() => [...tabs.map((tab) => ({ title: tab.title, run: () => onTab(tab.id) })), { title: 'Salvar arte', run: onSave }, { title: 'Exportar PNG', run: onExport }].filter((item) => item.title.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [onExport, onSave, onTab, query])
  if (!enabled || !open) return null
  return <div className="fixed inset-0 z-[110] grid place-items-start bg-black/60 pt-[12vh]" onMouseDown={() => setOpen(false)}><div role="dialog" aria-modal="true" aria-label="Central de comandos" className="w-full max-w-lg rounded-xl border border-ui-border bg-ui-panel p-3 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><label className="flex items-center gap-2 border-b border-ui-border pb-2"><Search className="size-4 text-ui-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-ui-text outline-none" placeholder="Buscar comandos…" /></label><div className="mt-2 space-y-1">{items.map((item) => <button key={item.title} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-ui-text hover:bg-ui-panel2" onClick={() => { item.run(); setOpen(false) }}><Command className="size-3 text-ui-muted" />{item.title}</button>)}</div></div></div>
}
