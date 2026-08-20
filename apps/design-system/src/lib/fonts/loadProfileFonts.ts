const SELF_HOSTED_FONTS = new Set(['Rajdhani', 'IBM Plex Sans', 'Space Grotesk'])

const loadedFonts = new Set<string>()

export async function loadProfileFonts(fontHeading: string, fontBody: string): Promise<void> {
  const toLoad = [fontHeading, fontBody].filter(
    (f) => !SELF_HOSTED_FONTS.has(f) && !loadedFonts.has(f),
  )

  if (toLoad.length === 0) return

  await Promise.all(
    toLoad.map(async (font) => {
      const encoded = encodeURIComponent(font)
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`
      document.head.appendChild(link)

      try {
        await document.fonts.ready
        loadedFonts.add(font)
      } catch {
        // Font load is best-effort; templates fall back to the default stack
      }
    }),
  )
}
