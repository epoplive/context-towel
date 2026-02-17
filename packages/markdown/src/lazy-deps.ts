/**
 * Lazy-loaded heavy dependencies — cached after first import.
 * Isolated in its own module to avoid circular imports.
 */
import type hljs from 'highlight.js'
import type mermaid from 'mermaid'

let _hljs: typeof hljs | null = null
let _hljsLoading: Promise<typeof hljs> | null = null

export function getHljs(): Promise<typeof hljs> {
  if (_hljs) return Promise.resolve(_hljs)
  if (!_hljsLoading) {
    _hljsLoading = import('highlight.js').then((m) => {
      _hljs = m.default
      return _hljs
    })
  }
  return _hljsLoading
}

let _mermaidModule: typeof mermaid | null = null
let _mermaidLoading: Promise<typeof mermaid> | null = null

export function getMermaid(): Promise<typeof mermaid> {
  if (_mermaidModule) return Promise.resolve(_mermaidModule)
  if (!_mermaidLoading) {
    _mermaidLoading = import('mermaid').then((m) => {
      _mermaidModule = m.default
      return _mermaidModule
    })
  }
  return _mermaidLoading
}
