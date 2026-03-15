import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tauri/index': 'src/tauri/index.ts',
    'node/index': 'src/node/index.ts',
    'http/index': 'src/http/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  // Externalize all platform bindings and node builtins — consumers
  // bring their own platform runtime.
  external: [
    /^@tauri-apps\//,
    'chokidar',
    /^node:/,
  ],
})
