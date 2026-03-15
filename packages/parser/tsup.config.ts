import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'plugins/index': 'src/plugins/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  // Externalize card-library and react — consumers share these.
  // Bundle remark/unified/unist-util-visit so the package is self-contained.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@context-towel/card-library',
    '@context-towel/file-service',
  ],
})
