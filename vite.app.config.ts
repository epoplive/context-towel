import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 5200,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Exclude workspace packages from pre-bundling so Vite always reads
    // the latest dist. Without this, Vite caches a stale version.
    exclude: [
      '@context-towel/markdown',
      '@context-towel/card-library',
      '@context-towel/context-graph',
      '@context-towel/file-service',
      '@context-towel/parser',
    ],
  },
  clearScreen: false,
})
