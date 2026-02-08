import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import hljs from 'highlight.js'
import mermaid from 'mermaid'
import renderMathInElement from 'katex/contrib/auto-render'
import emojiDictionary from 'emoji-dictionary'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import './markdown.css'
import 'katex/dist/katex.min.css'

import {
  CardRenderer,
  CardThemeProvider,
  blockRegistry,
  defaultTheme,
  registerAllCardPlugins,
  registerCoreBlocks,
  validateBlockYaml,
  type BlockInstance,
  type BlockParseError,
  type ThemeTokens,
} from '@context-towel/card-library'

import { buildMarkdownCssVars, deriveUiColors, resolveIsDark } from './markdown-renderer/theme'
import { useMermaidThemeTokens } from './markdown-renderer/mermaid'
import { FullscreenModal } from './markdown-renderer/FullscreenModal'
import type { FullscreenModalState, MarkdownRendererProps } from './markdown-renderer/types'

export type { FullscreenModalState, MarkdownRendererProps, CodeViewerComponent, CodeViewerProps } from './markdown-renderer/types'
export { FullscreenModal }

let _cardBlocksInitialized = false
function ensureCardBlocksInitialized() {
  if (_cardBlocksInitialized) return
  // Order matters: core seeds parse/validate; plugins attach render components.
  registerCoreBlocks()
  registerAllCardPlugins()
  _cardBlocksInitialized = true
}

const HIGHLIGHT_LANGUAGE_ALIASES: Record<string, string> = {
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

function normalizeHighlightLanguage(lang?: string): string | undefined {
  if (!lang) return undefined
  const normalized = lang.trim().toLowerCase()
  const aliased = HIGHLIGHT_LANGUAGE_ALIASES[normalized] || normalized
  return aliased.replace(/[^a-z0-9-]/g, '')
}

function isRenderableTypedBlock(type: string): boolean {
  const def = blockRegistry.get(type)
  if (!def) return false
  return Boolean(def.components && Object.keys(def.components).length > 0)
}

function toString(children: unknown): string {
  if (Array.isArray(children)) return children.map(toString).join('')
  return typeof children === 'string' ? children : String(children ?? '')
}

function setLookingGlassDragPayload(
  e: React.DragEvent,
  payload: { type: string; content: string; lang?: string },
) {
  e.dataTransfer.setData('text/plain', payload.content)
  e.dataTransfer.setData('application/x-looking-glass', JSON.stringify(payload))
}

const EMOJI_SHORTCODE_REGEX = /:([a-z0-9_+-]+):/gi

function remarkEmojiShortcodes() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node) return
      if (node.type === 'code' || node.type === 'inlineCode') return

      if (node.type === 'text' && typeof node.value === 'string' && node.value.includes(':')) {
        node.value = node.value.replace(EMOJI_SHORTCODE_REGEX, (match: string, name: string) => {
          const unicode = (emojiDictionary as { getUnicode?: (n: string) => string | undefined }).getUnicode?.(name)
          return unicode ?? match
        })
      }

      const children = node.children
      if (Array.isArray(children)) children.forEach(walk)
    }

    walk(tree)
  }
}

function BlockErrorCard({
  type,
  raw,
  errors,
  theme,
}: {
  type: string
  raw: string
  errors: BlockParseError[]
  theme: ThemeTokens
}) {
  const message = errors.map(e => e.message).filter(Boolean).join(', ') || 'Invalid block data'
  const preview = raw.length > 2000 ? raw.slice(0, 2000) + '\n…(truncated)…' : raw

  return (
    <div className="block-card">
      <div className="block-card-header">
        <span>{type}</span>
      </div>
      <div className="block-card-errors">
        {message}
      </div>
      <div className="block-card-body">
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 10, color: theme.textSecondary }}>
          {preview}
        </pre>
      </div>
    </div>
  )
}

function MermaidBlock({
  code,
  onOpenFullscreen,
  onDragStart,
  colors,
}: {
  code: string
  onOpenFullscreen: () => void
  onDragStart: (e: React.DragEvent) => void
  colors: { error: string; bgSecondary: string; textSecondary: string }
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      if (!containerRef.current) return
      if (!code.trim()) return
      setError(null)

      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}-${Math.random().toString(16).slice(2)}`, code)
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = svg
      } catch (e) {
        if (cancelled || !containerRef.current) return
        const message = e instanceof Error ? e.message : 'Failed to render diagram'
        setError(message)
        containerRef.current.innerHTML = ''
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div
      className="mermaid-block clickable-fullscreen"
      onClick={onOpenFullscreen}
      draggable
      onDragStart={onDragStart}
      title="Click to expand"
    >
      <div className="fullscreen-hint">Click to expand</div>
      {error ? (
        <div style={{ color: colors.error, padding: 10, background: colors.bgSecondary, borderRadius: 4 }}>
          <strong>Mermaid Error:</strong> {error}
          <pre style={{ marginTop: 8, fontSize: 11, color: colors.textSecondary }}>{code}</pre>
        </div>
      ) : (
        <div ref={containerRef} />
      )}
    </div>
  )
}

function HighlightedCode({
  code,
  lang,
}: {
  code: string
  lang?: string
}) {
  const normalized = normalizeHighlightLanguage(lang)
  let html = ''
  try {
    if (normalized && hljs.getLanguage(normalized)) {
      html = hljs.highlight(code, { language: normalized }).value
    } else {
      // Avoid highlight auto-detect for unknown languages; it's expensive and
      // tends to produce noisy output. Fall back to plain text.
      html = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }
  } catch {
    html = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  const className = normalized && hljs.getLanguage(normalized) ? `hljs language-${normalized}` : 'hljs language-plaintext'

  return (
    <code
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function MarkdownRenderer({
  content,
  theme,
  isDark,
  mermaidConfig,
  CodeViewer,
  codeBlockMode = 'highlight',
  codeBlockMaxHeight = 300,
  uiColors,
  onCheckboxChange,
  onFullscreen,
  onEditBlock,
}: MarkdownRendererProps) {
  ensureCardBlocksInitialized()

  const resolvedTheme = theme ?? defaultTheme
  const resolvedIsDark = resolveIsDark(isDark, resolvedTheme)
  useMermaidThemeTokens(resolvedTheme, resolvedIsDark, mermaidConfig)

  const colors = useMemo(
    () => deriveUiColors(resolvedTheme, resolvedIsDark, uiColors),
    [resolvedTheme, resolvedIsDark, uiColors],
  )

  const cssVars = useMemo(() => buildMarkdownCssVars(resolvedTheme, colors), [resolvedTheme, colors])

  const [fullscreen, setFullscreen] = useState<FullscreenModalState>({ open: false, type: null, content: '' })

  const openFullscreen = useCallback((type: 'mermaid' | 'code', raw: string, lang?: string) => {
    const state: FullscreenModalState = { open: true, type, content: raw, lang }
    if (onFullscreen) onFullscreen(state)
    else setFullscreen(state)
  }, [onFullscreen])

  const checkboxIndexRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  // KaTeX auto-render runs as a DOM post-pass. Keep it limited and resilient.
  useEffect(() => {
    if (!rootRef.current) return
    try {
      renderMathInElement(rootRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoredClasses: ['mermaid-block', 'markdown-code-block', 'excalidraw-block'],
        throwOnError: false,
        strict: 'ignore',
      })
    } catch (e) {
      console.error('Math render error:', e)
    }
  }, [content])

  // Reset checkbox counter each render so indices are stable within the document.
  checkboxIndexRef.current = 0

  const components = useMemo(() => {
    const inlineViewerEnabled = codeBlockMode === 'viewer' && Boolean(CodeViewer)
    const InlineCodeViewer = CodeViewer
    return {
      a: (props: any) => {
        // Preserve existing behavior: open links in new tab.
        return <a {...props} target="_blank" rel="noopener noreferrer" />
      },
      table: ({ children, ...props }: any) => (
        <div className="table-wrapper">
          <table {...props}>{children}</table>
        </div>
      ),
      li: ({ children, ...props }: any) => {
        const items = (Array.isArray(children) ? children : [children]).filter(Boolean)
        const first = items[0]
        const isTask = first && typeof first === 'object' && (first as any).type === 'input'
        if (!isTask) return <li {...props}>{children}</li>

        const rest = items.slice(1)
        return (
          <li {...props} className="task-list-item">
            {first}
            <span>{rest}</span>
          </li>
        )
      },
      input: ({ checked, type, ...props }: any) => {
        if (type !== 'checkbox') return <input {...props} type={type} />
        const index = checkboxIndexRef.current++
        const disabled = !onCheckboxChange
        return (
          <input
            {...props}
            type="checkbox"
            className="task-checkbox"
            checked={Boolean(checked)}
            disabled={disabled}
            onChange={(e) => onCheckboxChange?.(index, e.currentTarget.checked)}
          />
        )
      },
      code: ({ inline, className, children }: any) => {
        const raw = toString(children).replace(/\n$/, '')
        if (inline) return <code>{raw}</code>

        const match = /language-([^\s]+)/i.exec(className || '')
        const langRaw = match?.[1]?.trim()
        const langKey = langRaw ? langRaw.toLowerCase() : undefined

        if (langKey === 'mermaid') {
          return (
            <MermaidBlock
              code={raw}
              onOpenFullscreen={() => openFullscreen('mermaid', raw)}
              onDragStart={(e) => setLookingGlassDragPayload(e, { type: 'mermaid', content: raw })}
              colors={{ error: colors.error, bgSecondary: colors.bgSecondary, textSecondary: colors.textSecondary }}
            />
          )
        }

        if (langKey === 'excalidraw') {
          return (
            <div
              className="excalidraw-block"
              draggable
              onDragStart={(e) => setLookingGlassDragPayload(e, { type: 'excalidraw', content: raw })}
            >
              <div style={{ padding: 20, background: colors.bgSecondary, borderRadius: 8, color: colors.textMuted, textAlign: 'center' }}>
                [Excalidraw diagram - integration coming soon]
              </div>
            </div>
          )
        }

        if (langKey && isRenderableTypedBlock(langKey)) {
          const { data, errors } = validateBlockYaml(langKey, raw)
          const block: BlockInstance = {
            type: langKey,
            data,
            source: {
              filePath: '',
              range: { startOffset: null, endOffset: null, startLine: null, endLine: null },
              raw,
            },
            errors: errors.length > 0 ? errors : undefined,
          }

          if (!data || errors.length > 0) {
            return <BlockErrorCard type={langKey} raw={raw} errors={errors} theme={resolvedTheme} />
          }

          return (
            <div style={{ margin: '8px 0' }}>
              <CardThemeProvider theme={resolvedTheme}>
                <CardRenderer
                  block={block}
                  detail="full"
                  context="card"
                  onEdit={onEditBlock}
                />
              </CardThemeProvider>
            </div>
          )
        }

        // Default fenced code block.
        const languageLabel = langRaw || 'text'
        const onDragStart = (e: React.DragEvent) => setLookingGlassDragPayload(e, { type: 'code', content: raw, lang: langKey })
        const lineCount = Math.max(1, raw.split('\\n').length)
        const computedHeight = Math.min(codeBlockMaxHeight, Math.max(84, lineCount * 18 + 18))

        return (
          <div
            className="markdown-code-block clickable-fullscreen"
            draggable
            onDragStart={onDragStart}
            title="Click to expand"
          >
            <div
              className="code-header"
              onClick={() => openFullscreen('code', raw, langKey)}
              style={{ cursor: 'pointer' }}
            >
              <span className="code-lang">{languageLabel}</span>
              <span className="fullscreen-hint">Click to expand</span>
            </div>
            {inlineViewerEnabled ? (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ padding: 0, background: 'var(--color-bg-primary)', borderRadius: 0 }}
              >
                {InlineCodeViewer && (
                  <InlineCodeViewer
                    value={raw}
                    language={langKey}
                    readOnly
                    lineNumbers
                    wordWrap
                    minimap={false}
                    height={`${computedHeight}px`}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            ) : (
              <pre onClick={(e) => e.stopPropagation()}>
                <HighlightedCode code={raw} lang={langKey} />
              </pre>
            )}
          </div>
        )
      },
      blockquote: ({ children, ...props }: any) => {
        const text = toString(children).replace(/<[^>]*>/g, '')
        return (
          <blockquote
            {...props}
            draggable
            onDragStart={(e) => setLookingGlassDragPayload(e, { type: 'text', content: text })}
            title="Drag to terminal"
          >
            {children}
          </blockquote>
        )
      },
    }
  }, [
    colors.accent,
    colors.bgSecondary,
    colors.error,
    colors.textMuted,
    colors.textSecondary,
    codeBlockMode,
    codeBlockMaxHeight,
    CodeViewer,
    onCheckboxChange,
    onEditBlock,
    openFullscreen,
    resolvedTheme,
  ])

  return (
    <>
      <div
        ref={rootRef}
        className="markdown-body"
        style={{
          color: colors.textPrimary,
          fontSize: '12px',
          lineHeight: 1.4,
          ...(cssVars as CSSProperties),
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmojiShortcodes]} components={components as any}>
          {content}
        </ReactMarkdown>
      </div>

      {!onFullscreen && (
        <FullscreenModal
          state={fullscreen}
          onClose={() => setFullscreen({ open: false, type: null, content: '' })}
          theme={resolvedTheme}
          isDark={resolvedIsDark}
          mermaidConfig={mermaidConfig}
          CodeViewer={CodeViewer}
          uiColors={uiColors}
        />
      )}
    </>
  )
}
