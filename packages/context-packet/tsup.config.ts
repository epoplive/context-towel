import { defineConfig } from 'tsup'
import { cpSync, mkdirSync } from 'node:fs'

export default defineConfig({
  entry: ['src/index.ts', 'src/engine.ts', 'src/cli/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: [
    '@context-towel/core',
    '@context-towel/card-library',
    '@mikro-orm/core',
    '@mikro-orm/sqlite',
    'sql.js',
  ],
  banner({ format }) {
    // Add shebang only to the CLI entry point in ESM format
    if (format === 'esm') {
      return { js: '' }
    }
    return {}
  },
  onSuccess: async () => {
    // Copy slash command .md files into dist/commands/
    mkdirSync('dist/commands', { recursive: true })
    cpSync('src/commands', 'dist/commands', { recursive: true })
  },
})
