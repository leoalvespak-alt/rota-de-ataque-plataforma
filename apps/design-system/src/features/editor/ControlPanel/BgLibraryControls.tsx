import { useDecorStore, BG_LIBRARY } from '@/stores/useDecorStore'
import { cn } from '@/lib/utils'

/** Espelha buildBgControls() do Gerador/index.html original (linha 3134). */
export function BgLibraryControls() {
  const bgLibrarySelected = useDecorStore((s) => s.bgLibrarySelected)
  const setBgLibrarySelected = useDecorStore((s) => s.setBgLibrarySelected)

  return (
    <div className="mt-2 border-t-2 border-brand-red/20 px-4 pt-4 pb-3.5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-brand-red uppercase">
        Fundo da Biblioteca
      </div>
      <div className="flex flex-wrap gap-2">
        {BG_LIBRARY.map((bg) => (
          <div
            key={bg.id}
            title={bg.label}
            className={cn(
              'relative h-9 w-9 cursor-pointer rounded-md border',
              bgLibrarySelected === bg.id ? 'border-2 border-brand-red' : 'border-ui-border',
            )}
            style={{
              background:
                bg.type === 'none'
                  ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 10px 10px'
                  : bg.value,
            }}
            onClick={() => setBgLibrarySelected(bg.id)}
          >
            {bg.type === 'none' && (
              <div className="absolute inset-0 flex items-center justify-center text-base text-[#666]">✕</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
