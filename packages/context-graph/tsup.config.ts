import { defineConfig } from 'tsup'

// Build the embeddable library surface for consumption by host apps (Looking Glass, Felix, etc.).
// We keep a small set of explicit entrypoints so `package.json#exports` can point at `dist/*`.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    graph: 'src/graph-index.ts',
    embed: 'src/embed.ts',
    channel: 'src/channel.ts',
    types: 'src/types.ts',
    'compat/services': 'src/compat/services.ts',
    'compat/windowStorage': 'src/compat/windowStorage.ts',
    'compat/keybindings': 'src/compat/keybindings.ts',
    'compat/design-system': 'src/compat/design-system/index.ts',
    'plugins/task/idFixer': 'src/plugins/task/idFixer.ts',
    'plugins/task/types': 'src/plugins/task/types.ts',
  },
  format: ['esm'],
  platform: 'browser',
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: [
    // React must be shared with the host to avoid duplicate hook state.
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',

    // Keep sibling packages as real imports (not bundled) so hosts can dedupe.
    '@context-towel/card-library',
    '@context-towel/markdown',

    // External deps (installed by the package manager; bundlers handle them).
    '@dnd-kit/core',
    '@dnd-kit/utilities',
    '@monaco-editor/react',
    '@xyflow/react',
    '@xyflow/react/dist/style.css',
    'dagre',
    'lucide-react',
    'mermaid',
    // Parsing libs must remain external so node (vitest) doesn't import browser-only
    // variants that expect `document` at module init time.
    'remark-parse',
    'unified',
    'zustand',
  ],
})
