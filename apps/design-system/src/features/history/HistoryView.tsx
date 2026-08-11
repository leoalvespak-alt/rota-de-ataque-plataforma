import { useLibraryStore } from '@/stores/useLibraryStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useDecorStore } from '@/stores/useDecorStore'
import { useUiStore } from '@/stores/useUiStore'
import { HeaderPrimaryButton, HeaderSecondaryButton } from '@/app/HeaderButtons'
import { toast } from 'sonner'

/** Espelha loadHistory/saveCurrentArt/deleteArt/loadArt/buildHistoryPanel do Gerador/index.html (linhas 3668-3765). */
export function HistoryView() {
  const history = useLibraryStore((s) => s.history)
  const deleteArt = useLibraryStore((s) => s.deleteArt)
  const selectTemplate = useEditorStore((s) => s.selectTemplate)
  const replaceElements = useEditorStore((s) => s.replaceElements)
  const setTab = useUiStore((s) => s.setTab)

  const handleLoad = (id: string) => {
    const art = history.find((a) => a.id === id)
    if (!art) return
    replaceElements(structuredClone(art.elements), { darkMode: art.darkMode })
    useDecorStore.setState({
      watermark: structuredClone(art.watermark),
      texture: structuredClone(art.texture),
    })
    selectTemplate(art.templateId, { keepElements: true })
    setTab('create')
    toast.success('Arte carregada.')
  }

  return (
    <div className="flex-1 overflow-y-auto bg-ui-bg p-6 text-ui-text">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-6 font-heading text-2xl text-brand-red">Histórico de Artes</h2>
        {history.length === 0 ? (
          <p className="text-ui-muted">Nenhuma arte salva ainda. Crie uma e clique em "Salvar Arte".</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
            {history.map((art) => {
              const thumbUrl = art.thumb ? URL.createObjectURL(art.thumb) : null
              const date = new Date(art.timestamp)
              return (
                <div key={art.id} className="flex flex-col overflow-hidden rounded-xl border border-ui-border bg-ui-panel">
                  <div className="flex h-55 items-center justify-center bg-black">
                    {thumbUrl ? (
                      <img src={thumbUrl} className="max-h-full max-w-full object-contain" alt="" />
                    ) : (
                      <div className="text-[#666]">Sem miniatura</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="mb-1 text-[15px] font-semibold">{art.templateId}</div>
                    <div className="mb-4 text-xs text-ui-muted">
                      {date.toLocaleDateString()} às {date.toLocaleTimeString()}
                    </div>
                    <div className="flex gap-2">
                      <HeaderPrimaryButton className="flex-1 justify-center text-xs" onClick={() => handleLoad(art.id)}>
                        Carregar
                      </HeaderPrimaryButton>
                      <HeaderSecondaryButton className="text-xs text-brand-red" onClick={() => deleteArt(art.id)}>
                        Excluir
                      </HeaderSecondaryButton>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
