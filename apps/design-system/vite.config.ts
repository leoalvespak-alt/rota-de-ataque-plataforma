import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // FASE 13d — code-splitting: sem isso, html2canvas-pro/jszip/dnd-kit/motion (usados só
    // em fluxos específicos: export, série, animações) inflavam o chunk principal para >1MB.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
          if (id.includes('html2canvas-pro') || id.includes('jszip')) return 'vendor-export'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          if (id.includes('/motion/') || id.includes('framer-motion')) return 'vendor-motion'
          if (
            id.includes('react-hook-form') ||
            id.includes('/zod/') ||
            id.includes('@hookform') ||
            id.includes('react-dropzone')
          ) {
            return 'vendor-forms'
          }
          return 'vendor-misc'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
  },
})
