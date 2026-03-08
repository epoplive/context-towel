import { defineConfig } from 'tsup'
import path from 'path'

// Build the embeddable library surface for consumption by host apps (Looking Glass, Felix, etc.).
// We keep a small set of explicit entrypoints so `package.json#exports` can point at `dist/*`.
//
// Strategy: Bundle ALL deps except React (must be shared for hooks) and sibling
// @context-towel/* packages (shared across the host). This makes context-graph
// self-contained — hosts don't need to install @xyflow/react, dagre, mermaid, etc.
// Without bundling, hosts' Vite can't resolve transitive deps (@xyflow/system,
// classcat, d3-*) that live in context-towel's node_modules, causing ESM linking
// errors ("Importing binding name 'default' cannot be resolved by star export entries").

const shimDir = path.resolve(__dirname, 'src/shims')

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
  // Only externalize React (shared hook state) and sibling packages.
  // Everything else gets bundled into the output.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@context-towel/card-library',
    '@context-towel/markdown',
  ],
  // Override tsup's auto-externalization of dependencies listed in package.json.
  // We want them bundled so the output is self-contained.
  noExternal: [
    '@dnd-kit/core',
    '@dnd-kit/utilities',
    '@monaco-editor/react',
    '@xyflow/react',
    'dagre',
    'lucide-react',
    'mermaid',
    'remark-parse',
    'unified',
    'zustand',
  ],
  // Resolve process.env.NODE_ENV at build time so esbuild can statically
  // evaluate CJS conditional requires (e.g., use-sync-external-store/shim).
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  esbuildPlugins: [
    // Keep CSS imports external so the host bundler (Vite) resolves and injects
    // them. Without this, esbuild extracts CSS to sidecar files that nothing loads.
    {
      name: 'externalize-css',
      setup(build) {
        build.onResolve({ filter: /\.css$/ }, (args) => ({
          path: args.path,
          external: true,
        }))
      },
    },
  ],
  esbuildOptions(options) {
    // Replace CJS-only use-sync-external-store with ESM shims that use
    // React 18+'s built-in useSyncExternalStore.
    options.alias = {
      ...options.alias,
      'use-sync-external-store/shim/with-selector.js': path.join(shimDir, 'use-sync-external-store-with-selector.ts'),
      'use-sync-external-store/shim/with-selector': path.join(shimDir, 'use-sync-external-store-with-selector.ts'),
      'use-sync-external-store/shim/index.js': path.join(shimDir, 'use-sync-external-store-shim.ts'),
      'use-sync-external-store/shim': path.join(shimDir, 'use-sync-external-store-shim.ts'),
      'use-sync-external-store': path.join(shimDir, 'use-sync-external-store-shim.ts'),
    }
  },
})
