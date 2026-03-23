import { $view } from '@milkdown/utils'
import { codeBlockSchema } from '@milkdown/preset-commonmark'
import type { Ctx } from '@milkdown/ctx'
import type { NodeViewConstructor } from '@milkdown/prose/view'
import type hljs from 'highlight.js'

let _hljs: typeof hljs | null = null
let _hljsLoading: Promise<typeof hljs> | null = null

function getHljs(): Promise<typeof hljs> {
  if (_hljs) return Promise.resolve(_hljs)
  if (!_hljsLoading) {
    _hljsLoading = import('highlight.js').then((m) => {
      _hljs = m.default
      return _hljs
    })
  }
  return _hljsLoading
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rs: 'rust',
  md: 'markdown',
  'c++': 'cpp',
  'c#': 'csharp',
}

function normalizeLang(lang?: string): string | undefined {
  if (!lang) return undefined
  const normalized = lang.trim().toLowerCase()
  return LANGUAGE_ALIASES[normalized] || normalized
}

/**
 * Custom NodeView for code blocks that wraps them in the same
 * .markdown-code-block structure as MarkdownRenderer, including
 * the language header bar.
 *
 * Content is still editable — ProseMirror's contentDOM points
 * to the <code> element inside <pre>.
 *
 * Syntax highlighting is applied via highlight.js after ProseMirror
 * renders the text. In edit mode, ProseMirror will overwrite the
 * highlighting when the user types — this is acceptable since we
 * re-apply it on each update via requestAnimationFrame.
 */
export const codeBlockView = $view(codeBlockSchema.node, (_ctx: Ctx): NodeViewConstructor => {
  return (node) => {
    // Outer wrapper matching MarkdownRenderer's .markdown-code-block
    const dom = document.createElement('div')
    dom.classList.add('markdown-code-block')

    // Header bar with language label (not editable)
    const header = document.createElement('div')
    header.classList.add('code-header')
    header.contentEditable = 'false'
    const langSpan = document.createElement('span')
    langSpan.classList.add('code-lang')
    const lang = (node.attrs.language as string) || 'text'
    langSpan.textContent = lang
    header.appendChild(langSpan)
    dom.appendChild(header)

    // Pre > code — code is the contentDOM where ProseMirror puts text
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    pre.appendChild(code)
    dom.appendChild(pre)

    // Apply syntax highlighting after ProseMirror renders content
    function applyHighlighting(language: string) {
      const normalized = normalizeLang(language)
      getHljs().then((hljsModule) => {
        // Only highlight if code element still has text and is in the DOM
        if (!code.isConnected || !code.textContent) return
        try {
          if (normalized && hljsModule.getLanguage(normalized)) {
            const result = hljsModule.highlight(code.textContent, { language: normalized })
            code.innerHTML = result.value
            code.className = `hljs language-${normalized}`
          }
        } catch {
          // Keep plain text on error
        }
      })
    }

    // Schedule initial highlighting after ProseMirror populates contentDOM
    requestAnimationFrame(() => applyHighlighting(lang))

    return {
      dom,
      contentDOM: code,
      update(updatedNode) {
        if (updatedNode.type.name !== 'code_block') return false
        const newLang = (updatedNode.attrs.language as string) || 'text'
        langSpan.textContent = newLang
        // Re-highlight after ProseMirror updates content
        requestAnimationFrame(() => applyHighlighting(newLang))
        return true
      },
    }
  }
})
