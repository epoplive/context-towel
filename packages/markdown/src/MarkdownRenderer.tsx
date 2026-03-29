import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { getHljs, getMermaid } from './lazy-deps'
import emojiDictionary from 'emoji-dictionary'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { ensureStylesInjected } from './inject-styles'

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
import { stripWrapperTagLines } from './preprocess'

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

type WrappedTypedFence = { lang: string; body: string }

function parseWrappedTypedFence(raw: string): WrappedTypedFence | null {
  // Agents often wrap a typed block in a plain code fence to "be safe":
  //
  // ```text
  // ```task
  // ...
  // ```
  // ```
  //
  // When the outer fence has no language, react-markdown gives us a single code
  // node. We can unwrap the inner typed block if the content is exactly one
  // fenced block and nothing else.
  const normalized = raw.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null

  const lines = normalized.split('\n')
  let openerIndex = 0
  while (openerIndex < lines.length && !(lines[openerIndex] ?? '').trim()) openerIndex += 1
  if (openerIndex >= lines.length) return null

  const opener = lines[openerIndex] ?? ''
  const openMatch = opener.match(/^ {0,3}([`~]{3,})([^\n]*)$/)
  if (!openMatch) return null

  const fenceRun = openMatch[1] ?? ''
  const marker = fenceRun[0] === '~' ? '~' : '`'
  const fenceLen = fenceRun.length

  const info = (openMatch[2] ?? '').trim()
  const lang = info.split(/\s+/)[0]?.trim().toLowerCase()
  if (!lang) return null

  const closeRe = new RegExp(`^ {0,3}${marker}{${fenceLen},}\\s*$`)
  let closeIndex = -1
  for (let i = openerIndex + 1; i < lines.length; i++) {
    if (closeRe.test(lines[i] ?? '')) {
      closeIndex = i
      break
    }
  }
  if (closeIndex === -1) return null

  for (let i = closeIndex + 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trim()) return null
  }

  const body = lines.slice(openerIndex + 1, closeIndex).join('\n').trimEnd()
  return { lang, body }
}

function parseDanglingWrappedTypedFence(raw: string): WrappedTypedFence | null {
  // Some agent outputs accidentally produce invalid markdown when they wrap a
  // typed block inside ```text, because the inner ``` close line terminates the
  // outer fence. In that case react-markdown gives us a code node whose value
  // starts with ```task but is missing the closing fence line. Be liberal and
  // treat EOF as the close when it validates as a typed block.
  const normalized = raw.replace(/\r\n/g, '\n').trimEnd()
  if (!normalized) return null

  const lines = normalized.split('\n')
  let openerIndex = 0
  while (openerIndex < lines.length && !(lines[openerIndex] ?? '').trim()) openerIndex += 1
  if (openerIndex >= lines.length) return null

  const opener = lines[openerIndex] ?? ''
  const openMatch = opener.match(/^ {0,3}([`~]{3,})([^\n]*)$/)
  if (!openMatch) return null

  const fenceRun = openMatch[1] ?? ''
  const marker = fenceRun[0] === '~' ? '~' : '`'
  const fenceLen = fenceRun.length

  const info = (openMatch[2] ?? '').trim()
  const lang = info.split(/\s+/)[0]?.trim().toLowerCase()
  if (!lang) return null

  // If a proper close line exists, this isn't the broken-wrapper scenario.
  const closeRe = new RegExp(`^ {0,3}${marker}{${fenceLen},}\\\\s*$`)
  for (let i = openerIndex + 1; i < lines.length; i++) {
    if (closeRe.test(lines[i] ?? '')) return null
  }

  const body = lines.slice(openerIndex + 1).join('\n').trimEnd()
  if (!body.trim()) return null
  return { lang, body }
}

type FencedLineInfo = {
  indent: string
  marker: '`' | '~'
  len: number
  suffix: string
}

function parseFenceLine(line: string): FencedLineInfo | null {
  const m = line.match(/^( {0,3})([`~]{3,})([^\n]*)$/)
  if (!m) return null
  const indent = m[1] ?? ''
  const run = m[2] ?? ''
  const suffix = m[3] ?? ''
  const marker = run[0] === '~' ? '~' : '`'
  return { indent, marker, len: run.length, suffix }
}

function isFenceCloseLine(line: string, marker: '`' | '~', len: number): boolean {
  const closeRe = new RegExp(`^ {0,3}${marker}{${len},}\\\\s*$`)
  return closeRe.test(line)
}

function fenceLangFromSuffix(suffix: string): string | null {
  const info = suffix.trim()
  if (!info) return null
  const lang = info.split(/\s+/)[0]?.trim().toLowerCase()
  return lang || null
}

type FirstTypedFence = { lang: string; body: string; rest: string }

function parseFirstTypedFence(raw: string): FirstTypedFence | null {
  // Similar to parseWrappedTypedFence, but tolerant of extra trailing lines after
  // the closing fence. This happens when an agent accidentally places YAML keys
  // outside the typed block fence while still inside the wrapper code fence.
  const normalized = raw.replace(/\r\n/g, '\n').trimEnd()
  if (!normalized.trim()) return null

  const lines = normalized.split('\n')
  let openerIndex = 0
  while (openerIndex < lines.length && !(lines[openerIndex] ?? '').trim()) openerIndex += 1
  if (openerIndex >= lines.length) return null

  const opener = parseFenceLine(lines[openerIndex] ?? '')
  if (!opener) return null

  const lang = fenceLangFromSuffix(opener.suffix)
  if (!lang) return null

  let closeIndex = -1
  for (let i = openerIndex + 1; i < lines.length; i++) {
    if (isFenceCloseLine(lines[i] ?? '', opener.marker, opener.len)) {
      closeIndex = i
      break
    }
  }
  if (closeIndex === -1) return null

  const body = lines.slice(openerIndex + 1, closeIndex).join('\n').trimEnd()
  const rest = lines.slice(closeIndex + 1).join('\n').trim()
  return { lang, body, rest }
}

function repairConflictingWrappedTypedFences(markdown: string): string {
  if (!markdown) return markdown

  const normalized = markdown.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const out = [...lines]

  // Only attempt repairs at the top-level (not inside an existing fence), so
  // we don't "fix" code samples that intentionally demonstrate fence syntax.
  let activeFence: { marker: '`' | '~'; len: number } | null = null

  for (let i = 0; i < out.length; i++) {
    const line = out[i] ?? ''

    if (activeFence) {
      if (isFenceCloseLine(line, activeFence.marker, activeFence.len)) activeFence = null
      continue
    }

    const outer = parseFenceLine(line)
    if (!outer) continue

    const outerLang = fenceLangFromSuffix(outer.suffix)
    const shouldAttemptUnwrap = !outerLang || outerLang === 'text' || outerLang === 'plaintext'
    if (!shouldAttemptUnwrap) {
      activeFence = { marker: outer.marker, len: outer.len }
      continue
    }

    // Find the next non-empty line (inner fence opener).
    let j = i + 1
    while (j < out.length && !(out[j] ?? '').trim()) j += 1
    if (j >= out.length) {
      activeFence = { marker: outer.marker, len: outer.len }
      continue
    }

    const inner = parseFenceLine(out[j] ?? '')
    if (!inner) {
      activeFence = { marker: outer.marker, len: outer.len }
      continue
    }

    const innerLang = fenceLangFromSuffix(inner.suffix)
    if (!innerLang || !isRenderableTypedBlock(innerLang)) {
      activeFence = { marker: outer.marker, len: outer.len }
      continue
    }

    // If the wrapper fence marker/length can be closed by the inner block's
    // closing fence, the markdown becomes invalid and the renderer can't unwrap.
    // Fix by increasing the wrapper fence length and its closing line.
    const isConflicting = outer.marker === inner.marker && outer.len <= inner.len
    if (!isConflicting) {
      activeFence = { marker: outer.marker, len: outer.len }
      continue
    }

    const innerCloseRe = new RegExp(`^ {0,3}${inner.marker}{${inner.len},}\\\\s*$`)
    let innerCloseIndex = -1
    for (let k = j + 1; k < out.length; k++) {
      if (innerCloseRe.test(out[k] ?? '')) {
        innerCloseIndex = k
        break
      }
    }
    if (innerCloseIndex === -1) {
      activeFence = { marker: outer.marker, len: outer.len }
      continue
    }

    const outerCloseIndex = innerCloseIndex + 1
    if (outerCloseIndex >= out.length || !isFenceCloseLine(out[outerCloseIndex] ?? '', outer.marker, outer.len)) {
      activeFence = { marker: outer.marker, len: outer.len }
      continue
    }

    const newLen = inner.len + 1
    const newRun = outer.marker.repeat(newLen)

    // Rewrite the wrapper opener and wrapper close fence to the longer run.
    out[i] = `${outer.indent}${newRun}${outer.suffix}`

    const closeLine = out[outerCloseIndex] ?? ''
    const closeMatch = closeLine.match(/^( {0,3})([`~]{3,})(\s*)$/)
    const closeIndent = closeMatch?.[1] ?? ''
    const closeTrail = closeMatch?.[3] ?? ''
    out[outerCloseIndex] = `${closeIndent}${newRun}${closeTrail}`

    // Skip over the wrapper fence we just repaired.
    i = outerCloseIndex
  }

  return out.join('\n')
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
  themeKey,
  onOpenFullscreen,
  onDragStart,
  colors,
}: {
  code: string
  themeKey: string
  onOpenFullscreen: () => void
  onDragStart: (e: React.DragEvent) => void
  colors: { error: string; bgSecondary: string; textSecondary: string }
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      if (!containerRef.current) return
      if (!code.trim()) return
      setError(null)

      try {
        const mermaidModule = await getMermaid()
        if (cancelled || !containerRef.current) return
        const { svg } = await mermaidModule.render(`mermaid-${Date.now()}-${Math.random().toString(16).slice(2)}`, code)
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
  }, [code, themeKey])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(z => Math.min(4, Math.max(0.25, Math.round((z + delta) * 100) / 100)))
  }, [])

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100))
  }, [])

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setZoom(z => Math.max(0.25, Math.round((z - 0.25) * 100) / 100))
  }, [])

  const handleZoomReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setZoom(1)
  }, [])

  const zoomChanged = zoom !== 1

  return (
    <div
      className="mermaid-block clickable-fullscreen"
      onClick={onOpenFullscreen}
      draggable
      onDragStart={onDragStart}
      onWheel={handleWheel}
      title="Click to expand"
    >
      <div className="fullscreen-hint">Click to expand</div>
      {!error && (
        <div className="mermaid-zoom-controls" onClick={(e) => e.stopPropagation()}>
          <button className="mermaid-zoom-btn" onClick={handleZoomOut} title="Zoom out">−</button>
          <span className="mermaid-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="mermaid-zoom-btn" onClick={handleZoomIn} title="Zoom in">+</button>
          {zoomChanged && (
            <button className="mermaid-zoom-btn" onClick={handleZoomReset} title="Reset zoom">↺</button>
          )}
        </div>
      )}
      {error ? (
        <div style={{ color: colors.error, padding: 10, background: colors.bgSecondary, borderRadius: 4 }}>
          <strong>Mermaid Error:</strong> {error}
          <pre style={{ marginTop: 8, fontSize: 11, color: colors.textSecondary }}>{code}</pre>
        </div>
      ) : (
        <div className="mermaid-svg-viewport">
          <div
            className="mermaid-svg-scaler"
            style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined }}
            ref={containerRef}
          />
        </div>
      )}
    </div>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function HighlightedCode({
  code,
  lang,
}: {
  code: string
  lang?: string
}) {
  const normalized = normalizeHighlightLanguage(lang)
  const [html, setHtml] = useState(() => escapeHtml(code))
  const [className, setClassName] = useState('hljs language-plaintext')

  useEffect(() => {
    let cancelled = false
    getHljs().then((hljsModule) => {
      if (cancelled) return
      try {
        if (normalized && hljsModule.getLanguage(normalized)) {
          setHtml(hljsModule.highlight(code, { language: normalized }).value)
          setClassName(`hljs language-${normalized}`)
        }
      } catch {
        // Keep escaped fallback
      }
    })
    return () => { cancelled = true }
  }, [code, normalized])

  return (
    <code
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function MarkdownRenderer({
  content,
  host,
  theme,
  isDark,
  mermaidConfig,
  CodeViewer,
  codeBlockMode = 'highlight',
  codeBlockMaxHeight = 300,
  uiColors,
  resolveImageSrc,
  onCheckboxChange,
  onFullscreen,
  onEditBlock,
}: MarkdownRendererProps) {
  ensureStylesInjected()
  ensureCardBlocksInitialized()

  // Pre-scan content to build a deterministic block index map.
  // Maps raw block content → { type, index } so we can look up any block's
  // sequential index without relying on render order.
  const blockIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    const counters: Record<string, number> = {}
    const pattern = /~~~(\w+)\s*\n([\s\S]*?)~~~/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const type = match[1]!
      const raw = match[2]!.trim()
      const idx = counters[type] ?? 0
      counters[type] = idx + 1
      map.set(`${type}::${raw}`, idx)
    }
    return map
  }, [content])

  const resolvedTheme = theme ?? defaultTheme
  const resolvedIsDark = resolveIsDark(isDark, resolvedTheme)
  const mermaidThemeKey = useMermaidThemeTokens(resolvedTheme, resolvedIsDark, mermaidConfig)

  const preprocessedContent = useMemo(
    () => repairConflictingWrappedTypedFences(stripWrapperTagLines(content)),
    [content],
  )

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

  // KaTeX auto-render runs as a DOM post-pass. Lazy-loaded to avoid 600KB upfront.
  useEffect(() => {
    if (!rootRef.current) return
    let cancelled = false
    import('katex/contrib/auto-render').then((mod) => {
      if (cancelled || !rootRef.current) return
      const renderMath = mod.default || mod
      try {
        renderMath(rootRef.current, {
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
    }).catch((e) => {
      if (!cancelled) console.error('Failed to load KaTeX:', e)
    })
    return () => { cancelled = true }
  }, [preprocessedContent])

  // Reset checkbox counter each render so indices are stable within the document.
  checkboxIndexRef.current = 0

  const components = useMemo(() => {
    const inlineViewerEnabled = codeBlockMode === 'viewer' && Boolean(CodeViewer)
    const InlineCodeViewer = CodeViewer
    return {
      pre: ({ children }: any) => {
        // Our code component handles all fenced block rendering (cards, mermaid,
        // code blocks) with proper wrappers. Skip ReactMarkdown's outer <pre> to
        // prevent double padding, compounded font-size (85% × 0.867em), and extra
        // backgrounds leaking through.
        return <>{children}</>
      },
      a: (props: any) => {
        // Preserve existing behavior: open links in new tab.
        return <a {...props} target="_blank" rel="noopener noreferrer" />
      },
      img: ({ src, alt, ...props }: any) => {
        const resolved = src && resolveImageSrc ? resolveImageSrc(src) : src
        return <img {...props} src={resolved} alt={alt ?? ''} />
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
      code: ({ className, children }: any) => {
        const raw = toString(children).replace(/\n$/, '')

        // react-markdown v10 no longer passes `inline` to `code` components.
        // Heuristic: inline code has no language class and no newlines.
        const match = /language-([^\s]+)/i.exec(className || '')
        const isInline = !match && !raw.includes('\n')
        if (isInline) return <code>{raw}</code>

        const langRaw = match?.[1]?.trim()
        const langKey = langRaw ? langRaw.toLowerCase() : undefined
        // Monaco (CodeViewer) expects canonical language ids (e.g. "typescript" not "ts").
        const viewerLang = normalizeHighlightLanguage(langKey)

        // A dangling fence line like ``` at EOF becomes an empty code block.
        // Hide it; it is almost always accidental and produces ugly blank pages.
        const isTextish = !langKey || langKey === 'text' || langKey === 'plaintext'
        if (isTextish && !raw.trim()) return null

        if (langKey === 'mermaid') {
          return (
            <MermaidBlock
              code={raw}
              themeKey={mermaidThemeKey}
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
                  onEdit={onEditBlock ? (event: any) => {
                    const idx = blockIndexMap.get(`${block.type}::${block.source.raw.trim()}`) ?? 0
                    onEditBlock({
                      ...event,
                      blockIndex: idx,
                      sourcePath: block.source.filePath,
                      sourceLine: block.data && typeof block.data === 'object' && 'id' in block.data
                        ? (block.data as any).id
                        : undefined,
                    })
                  } : undefined}
                  host={host}
                />
              </CardThemeProvider>
            </div>
          )
        }

        // If this is a plain code block that contains exactly one typed fenced
        // block, unwrap it so agents can safely wrap blocks.
        //
        // In practice agents often use ```text as the outer fence.
        const shouldAttemptUnwrap = !langKey || langKey === 'text' || langKey === 'plaintext'
        if (shouldAttemptUnwrap) {
          const wrapped = parseWrappedTypedFence(raw) ?? parseDanglingWrappedTypedFence(raw)
          if (wrapped && isRenderableTypedBlock(wrapped.lang)) {
            const { data, errors } = validateBlockYaml(wrapped.lang, wrapped.body)
            const block: BlockInstance = {
              type: wrapped.lang,
              data,
              source: {
                filePath: '',
                range: { startOffset: null, endOffset: null, startLine: null, endLine: null },
                raw,
              },
              errors: errors.length > 0 ? errors : undefined,
            }

            if (!data || errors.length > 0) {
              return <BlockErrorCard type={wrapped.lang} raw={wrapped.body} errors={errors} theme={resolvedTheme} />
            }

            return (
              <div style={{ margin: '8px 0' }}>
                <CardThemeProvider theme={resolvedTheme}>
                  <CardRenderer
                    block={block}
                    detail="full"
                    context="card"
                    onEdit={onEditBlock ? (event: any) => {
                    const idx = blockIndexMap.get(`${block.type}::${block.source.raw.trim()}`) ?? 0
                    onEditBlock({
                      ...event,
                      blockIndex: idx,
                      sourcePath: block.source.filePath,
                      sourceLine: block.data && typeof block.data === 'object' && 'id' in block.data
                        ? (block.data as any).id
                        : undefined,
                    })
                  } : undefined}
                    host={host}
                  />
                </CardThemeProvider>
              </div>
            )
          }

          // More forgiving unwrap: if the code block starts with a typed fence,
          // render the card even when trailing lines exist (common agent mistake).
          const first = parseFirstTypedFence(raw)
          if (first && isRenderableTypedBlock(first.lang)) {
            const mergedBody = first.rest ? `${first.body}\n${first.rest}` : first.body

            // Prefer the merged body when it validates cleanly; this preserves
            // YAML keys that were accidentally placed after the closing fence.
            const mergedValidation = first.rest ? validateBlockYaml(first.lang, mergedBody) : null
            const primaryValidation = validateBlockYaml(first.lang, first.body)

            const chosenBody =
              mergedValidation && mergedValidation.data && mergedValidation.errors.length === 0
                ? mergedBody
                : first.body
            const chosenValidation =
              mergedValidation && mergedValidation.data && mergedValidation.errors.length === 0
                ? mergedValidation
                : primaryValidation

            const { data, errors } = chosenValidation
            const block: BlockInstance = {
              type: first.lang,
              data,
              source: {
                filePath: '',
                range: { startOffset: null, endOffset: null, startLine: null, endLine: null },
                raw: chosenBody,
              },
              errors: errors.length > 0 ? errors : undefined,
            }

            if (!data || errors.length > 0) {
              return <BlockErrorCard type={first.lang} raw={chosenBody} errors={errors} theme={resolvedTheme} />
            }

            const rendered = (
              <div style={{ margin: '8px 0' }}>
                <CardThemeProvider theme={resolvedTheme}>
                  <CardRenderer
                    block={block}
                    detail="full"
                    context="card"
                    onEdit={onEditBlock ? (event: any) => {
                    const idx = blockIndexMap.get(`${block.type}::${block.source.raw.trim()}`) ?? 0
                    onEditBlock({
                      ...event,
                      blockIndex: idx,
                      sourcePath: block.source.filePath,
                      sourceLine: block.data && typeof block.data === 'object' && 'id' in block.data
                        ? (block.data as any).id
                        : undefined,
                    })
                  } : undefined}
                    host={host}
                  />
                </CardThemeProvider>
              </div>
            )

            const shouldRenderTrailing = first.rest && chosenBody === first.body
            if (!shouldRenderTrailing) return rendered

            return (
              <>
                {rendered}
                <div className="markdown-code-block" style={{ marginTop: 8 }}>
                  <div className="code-header">
                    <span className="code-lang">text</span>
                  </div>
                  <pre>
                    <HighlightedCode code={first.rest} lang="text" />
                  </pre>
                </div>
              </>
            )
          }
        }

        // Default fenced code block.
        const languageLabel = langRaw || 'text'
        const onDragStart = (e: React.DragEvent) => setLookingGlassDragPayload(e, { type: 'code', content: raw, lang: langKey })
        const lineCount = Math.max(1, raw.split('\\n').length)
        const computedHeight = Math.min(codeBlockMaxHeight, Math.max(84, lineCount * 18 + 18))

        if (inlineViewerEnabled) {
          return (
            <div
              className="markdown-code-block clickable-fullscreen"
              draggable
              onDragStart={onDragStart}
              title="Click to expand"
            >
              <div
                className="code-header"
                onClick={() => openFullscreen('code', raw, viewerLang)}
                style={{ cursor: 'pointer' }}
              >
                <span className="code-lang">{languageLabel}</span>
                <span className="fullscreen-hint">Click to expand</span>
              </div>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ padding: 0, background: 'var(--color-bg-primary)', borderRadius: 0 }}
              >
                {InlineCodeViewer && (
                  <InlineCodeViewer
                    value={raw}
                    language={viewerLang}
                    readOnly
                    lineNumbers
                    wordWrap
                    minimap={false}
                    height={`${computedHeight}px`}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            </div>
          )
        }

        return (
          <div className="markdown-code-block">
            <div className="code-header">
              <span className="code-lang">{languageLabel}</span>
            </div>
            <pre>
              <HighlightedCode code={raw} lang={langKey} />
            </pre>
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
    host,
    mermaidThemeKey,
    onCheckboxChange,
    onEditBlock,
    openFullscreen,
    resolveImageSrc,
    resolvedTheme,
  ])

  return (
    <>
      <div
        ref={rootRef}
        className="markdown-body"
        style={{
          color: colors.textPrimary,
          ...(cssVars as CSSProperties),
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmojiShortcodes]} components={components as any}>
          {preprocessedContent}
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
