import { useDecorStore } from '@/stores/useDecorStore'
import { getTextureSVG } from '@/lib/textures'

/** Espelha applyTextureLayer()/updateTextureLayer() do Gerador/index.html (linhas 3182-3208). */
export function TextureLayer({ dark }: { dark: boolean }) {
  const texture = useDecorStore((s) => s.texture)

  if (!texture.enabled || texture.type === 'none') return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 6,
        backgroundRepeat: 'repeat',
        backgroundImage: getTextureSVG(texture.type, dark),
        opacity: texture.opacity,
      }}
    />
  )
}
