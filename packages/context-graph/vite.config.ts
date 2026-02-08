import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileServerPlugin } from './src/dev/viteFileServerPlugin'
import path from 'node:path'

// Point at the example project, or override with CONTEXT_TOWEL_PROJECT env var
const projectDir = process.env.CONTEXT_TOWEL_PROJECT
  || path.resolve(__dirname, '../../example')

export default defineConfig({
  plugins: [
    react(),
    fileServerPlugin(projectDir),
  ],
  root: '.',
  server: {
    port: 5200,
  },
  // Keep the example app build separate from the embeddable library `dist/`.
  build: {
    outDir: 'dist-app',
    emptyOutDir: true,
  },
})
