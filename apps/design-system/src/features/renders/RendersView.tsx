import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { useLibraryStore, RENDER_CATEGORIES, type RenderCategory } from '@/stores/useLibraryStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useUiStore } from '@/stores/useUiStore'
import { cn } from '@/lib/utils'
import { HeaderPrimaryButton, HeaderSecondaryButton } from '@/app/HeaderButtons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Espelha a aba "Renders" do Gerador/index.html original (loadRenders/saveRenderObj/
 * deleteRender/useRender/handleRenderUpload/buildRendersView, linhas 3565-3663).
 *
 * Diferenças (melhorias, não regressões):
 * - Upload via react-dropzone (drag-and-drop) além do clique — o original só suportava clique.
 * - Nome/categoria coletados num Dialog acessível (Radix) em vez de dois `prompt()` nativos
 *   do navegador (o original usava `prompt('Nome do Render:')` e `prompt('Categoria...')`).
 * - Armazenamento em IndexedDB como Blob nativo (useLibraryStore), não base64 em localStorage
 *   — resolve a dívida D2 da análise do projeto.
 */
export function RendersView() {
  const renders = useLibraryStore((s) => s.renders)
  const addRender = useLibraryStore((s) => s.addRender)
  const deleteRender = useLibraryStore((s) => s.deleteRender)
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const setElementField = useEditorStore((s) => s.setElementField)
  const setTab = useUiStore((s) => s.setTab)

  const [activeCategory, setActiveCategory] = useState<'all' | RenderCategory>('all')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [renderName, setRenderName] = useState('')
  const [renderCategory, setRenderCategory] = useState<RenderCategory>('pessoas')

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setPendingFile(file)
    setRenderName(file.name.replace(/\.[^.]+$/, ''))
  }, [])

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/png': [], 'image/webp': [] },
    maxFiles: 1,
    noClick: false,
  })

  const confirmUpload = () => {
    if (!pendingFile || !renderName.trim()) return
    addRender({ name: renderName.trim(), category: renderCategory, blob: pendingFile })
    setPendingFile(null)
    setRenderName('')
    toast.success('Render adicionado à biblioteca.')
  }

  const handleUseRender = (id: string) => {
    if (!activeTemplateId) {
      toast.error('Selecione um template primeiro.')
      return
    }
    const render = renders.find((r) => r.id === id)
    if (!render) return
    const url = URL.createObjectURL(render.blob)
    setElementField(['bgImg'], url)
    setTab('create')
    toast.success('Render aplicado ao card.')
  }

  const filtered = activeCategory === 'all' ? renders : renders.filter((r) => r.category === activeCategory)

  return (
    <div className="flex-1 overflow-y-auto bg-ui-bg p-6 text-ui-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-heading text-2xl text-brand-red">Biblioteca de Renders</h2>
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            <HeaderPrimaryButton type="button">+ Upload Render (PNG sem fundo)</HeaderPrimaryButton>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5">
          <HeaderSecondaryButton active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
            Todos
          </HeaderSecondaryButton>
          {RENDER_CATEGORIES.map((cat) => (
            <HeaderSecondaryButton
              key={cat.id}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.icon} {cat.label}
            </HeaderSecondaryButton>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-ui-muted">Nenhum render salvo nesta categoria.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
            {filtered.map((r) => (
              <RenderCard key={r.id} render={r} onUse={handleUseRender} onDelete={deleteRender} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={pendingFile !== null} onOpenChange={(open) => !open && setPendingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Render</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5 block">Nome do Render</Label>
              <Input value={renderName} onChange={(e) => setRenderName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Categoria</Label>
              <Select value={renderCategory} onValueChange={(v) => setRenderCategory(v as RenderCategory)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RENDER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <HeaderSecondaryButton onClick={() => setPendingFile(null)}>Cancelar</HeaderSecondaryButton>
            <HeaderPrimaryButton onClick={confirmUpload}>Salvar</HeaderPrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RenderCard({
  render,
  onUse,
  onDelete,
}: {
  render: { id: string; name: string; category: string; blob: Blob }
  onUse: (id: string) => void
  onDelete: (id: string) => void
}) {
  const url = URL.createObjectURL(render.blob)
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-ui-border bg-ui-panel">
      <div
        className={cn(
          'flex h-37.5 items-center justify-center p-2.5',
          'bg-[repeating-conic-gradient(#ccc_0%_25%,#e5e5f7_0%_50%)] [background-size:20px_20px]',
        )}
      >
        <img src={url} className="max-h-full max-w-full object-contain" alt={render.name} />
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold">{render.name}</div>
        <div className="mb-3 text-xs text-ui-muted capitalize">{render.category}</div>
        <div className="flex gap-1.5">
          <HeaderPrimaryButton className="flex-1 justify-center text-[11px]" onClick={() => onUse(render.id)}>
            Usar
          </HeaderPrimaryButton>
          <HeaderSecondaryButton className="text-[11px] text-brand-red" onClick={() => onDelete(render.id)}>
            Excluir
          </HeaderSecondaryButton>
        </div>
      </div>
    </div>
  )
}
