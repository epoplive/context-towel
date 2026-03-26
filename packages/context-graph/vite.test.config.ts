import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Lightweight Vite config for the Playwright test harness.
// Serves the PacketWorkspace with embedded fixture data — no file server needed.
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  server: {
    port: 5201,
    strictPort: true,
  },
  build: {
    outDir: 'dist-test',
    rollupOptions: {
      input: path.resolve(__dirname, 'test-harness.html'),
    },
  },
})
