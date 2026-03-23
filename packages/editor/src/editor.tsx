import { useMemo, useRef, useEffect, useImperativeHandle, forwardRef, type CSSProperties } from 'react'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { Editor as MilkdownEditor, defaultValueCtx, rootCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { replaceAll } from '@milkdown/utils'
import type { BlockEditEvent, ThemeTokens } from '@context-towel/card-library'
import { ensureEditorStyles } from './editor-styles'
import { remarkCardBlocksPlugin } from './remark/card-blocks'
import { remarkMermaidBlocksPlugin } from './remark/mermaid-blocks'
import { remarkEmojiShortcodesPlugin } from './remark/emoji-shortcodes'
import { cardBlockSchema } from './schema/card-node'
import { cardBlockView, cardViewConfig, activeCardRenders } from './schema/card-node-view'
import { mermaidBlockSchema, mermaidBlockView, mermaidViewConfig } from './schema/mermaid-node'
import { codeBlockView } from './schema/code-block-view'
import { slash, configureSlash } from './plugins/slash'
import { blockPlugin, setupBlockHandle } from './plugins/block-handle'

/** Imperative handle for controlling the editor from outside React's data flow. */
export interface EditorHandle {
  /** Replace the entire editor content. Use for external updates (file reload, block patch). */
  replaceContent(markdown: string): void
  /** Read the current markdown from the editor's internal state. */
  getMarkdown(): string
}

export interface MarkdownEditorProps {
  /** Initial markdown content (only read on mount — editor is uncontrolled after that) */
  content: string
  /** When false, renders as a read-only document viewer. Default: true */
  editable?: boolean
  /** Called when the markdown content changes (from prose edits) */
  onChange?: (markdown: string) => void
  /** Called when a card widget is edited (checkbox, dropdown, etc.) */
  onCardEdit?: (event: BlockEditEvent) => void
  /** Theme tokens for card rendering — sets CSS variables matching markdown.css */
  theme?: ThemeTokens
  /** Whether the current theme is dark mode */
  isDark?: boolean
  /**
   * Resolve an image src to a loadable URL. Called for every `<img>` in the
   * rendered document. Use to convert relative/absolute file paths to asset
   * protocol URLs in Tauri.
   */
  resolveImageSrc?: (src: string) => string
  /** Additional CSS class for the editor container */
  className?: string
}

/**
 * Build CSS custom properties from ThemeTokens.
 * Same variable names as @context-towel/markdown's buildMarkdownCssVars
 * so the editor looks identical to MarkdownRenderer.
 */
function buildCssVars(theme: ThemeTokens, isDark: boolean): Record<string, string> {
  return {
    '--color-bg-primary': theme.bgPrimary,
    '--color-bg-secondary': theme.bgSecondary,
    '--color-bg-tertiary': theme.bgTertiary,
    '--color-bg-overlay': isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.35)',
    '--color-border-primary': theme.borderPrimary,
    '--color-border-secondary': theme.borderSecondary,
    '--color-text-primary': theme.textPrimary,
    '--color-text-secondary': theme.textSecondary,
    '--color-text-muted': theme.textMuted,
    '--color-text-inverse': theme.textInverse,
    '--color-accent': theme.accent,
    '--color-accent-muted': `color-mix(in srgb, ${theme.accent} 15%, transparent)`,
    '--color-success': theme.success,
    '--color-success-muted': `color-mix(in srgb, ${theme.success} 15%, transparent)`,
    '--color-warning': theme.warning,
    '--color-error': theme.error,
    '--color-info': theme.info,
    '--color-info-muted': `color-mix(in srgb, ${theme.info} 15%, transparent)`,
  }
}

const EditorInner = forwardRef<EditorHandle, MarkdownEditorProps>(function EditorInner(
  { content, editable = true, onChange, onCardEdit, theme, isDark, resolveImageSrc, className },
  ref,
) {
  ensureEditorStyles()

  const contentRef = useRef(content)
  const editableRef = useRef(editable)
  editableRef.current = editable
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Tracks the latest markdown the editor produced, for getMarkdown().
  const lastEmittedRef = useRef(content)

  // Keep cardViewConfig in sync with props so NodeViews read current values
  cardViewConfig.theme = theme
  cardViewConfig.onEdit = onCardEdit

  // Keep mermaidViewConfig in sync so the NodeView re-initialises mermaid
  // with the correct theme variables whenever props change
  mermaidViewConfig.theme = theme
  mermaidViewConfig.isDark = isDark ?? true

  // Re-render all active card NodeViews when theme changes so they pick up
  // the new colors. NodeViews are independent React roots outside the main
  // tree, so they don't re-render from parent prop changes alone.
  const prevThemeRef = useRef(theme)
  useEffect(() => {
    if (prevThemeRef.current === theme) return
    prevThemeRef.current = theme
    for (const rerender of activeCardRenders) rerender()
  }, [theme])

  // Build CSS variables from theme tokens — same vars as markdown.css
  const containerStyle = useMemo<CSSProperties>(() => {
    if (!theme) return {}
    const vars = buildCssVars(theme, isDark ?? true)
    return {
      // Set CSS custom properties for child selectors (borders, code blocks, etc.)
      ...vars as unknown as CSSProperties,
      // Set critical styles directly so they inherit without relying on CSS cascade
      color: theme.textPrimary,
      background: 'transparent',
    }
  }, [theme, isDark])

  useEditor((root) => {
    return MilkdownEditor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, contentRef.current)
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => editableRef.current,
        }))
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            lastEmittedRef.current = markdown
            onChangeRef.current?.(markdown)
          }
        })
        // Configure slash menu view inside the plugin spec
        configureSlash(ctx)
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(remarkEmojiShortcodesPlugin)
      .use(remarkMermaidBlocksPlugin)
      .use(mermaidBlockSchema)
      .use(mermaidBlockView)
      .use(remarkCardBlocksPlugin)
      .use(cardBlockSchema)
      .use(cardBlockView)
      .use(codeBlockView)
      .use(slash)
      .use(blockPlugin)
  }, [])

  // Editor is uncontrolled — content prop is only read on mount.
  // External updates go through the imperative EditorHandle.
  const [loading, getEditor] = useInstance()

  useImperativeHandle(ref, () => ({
    replaceContent(markdown: string) {
      lastEmittedRef.current = markdown
      const editor = getEditor()
      if (editor) editor.action(replaceAll(markdown))
    },
    getMarkdown() {
      return lastEmittedRef.current
    },
  }), [getEditor])

  // Block drag handles — only in edit mode, after editor mounts
  useEffect(() => {
    if (loading || !editable) return
    const editor = getEditor()
    if (!editor) return
    return setupBlockHandle(editor.ctx)
  }, [loading, getEditor, editable])

  // KaTeX math rendering — runs after content loads or changes
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    let cancelled = false
    import('katex/contrib/auto-render').then((mod) => {
      if (cancelled || !el.isConnected) return
      const renderMath = mod.default
      renderMath(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoredClasses: ['mermaid-block', 'markdown-code-block'],
        throwOnError: false,
        strict: 'ignore',
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [content])

  // Resolve image src attributes (relative paths → asset protocol, etc.)
  const resolveImageSrcRef = useRef(resolveImageSrc)
  resolveImageSrcRef.current = resolveImageSrc
  useEffect(() => {
    const el = editorRef.current
    const resolve = resolveImageSrcRef.current
    if (!el || !resolve) return

    let rewriting = false
    const rewrite = () => {
      if (rewriting) return
      rewriting = true
      for (const img of el.querySelectorAll<HTMLImageElement>('img[src]')) {
        const src = img.getAttribute('src')
        if (!src) continue
        const resolved = resolve(src)
        if (resolved !== src) img.setAttribute('src', resolved)
      }
      rewriting = false
    }

    // Run immediately for current content
    rewrite()

    // Observe for new images AND src attribute changes
    const observer = new MutationObserver(rewrite)
    observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
    return () => observer.disconnect()
  }, [content, loading])

  // In read-only mode, handle clicks on anchor links to scroll to headings
  useEffect(() => {
    if (editable) return
    const el = editorRef.current
    if (!el) return
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return

      if (href.startsWith('#')) {
        // Anchor link — scroll to heading with matching id
        e.preventDefault()
        const targetId = href.slice(1)
        const target = el.querySelector(`[id="${CSS.escape(targetId)}"]`)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        // External link — open in new tab
        e.preventDefault()
        window.open(href, '_blank', 'noopener,noreferrer')
      }
    }
    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [editable])

  return (
    <div ref={editorRef} className={`context-towel-editor${editable ? '' : ' context-towel-editor--readonly'} ${className ?? ''}`} style={containerStyle}>
      <Milkdown />
    </div>
  )
})

export const MarkdownEditor = forwardRef<EditorHandle, MarkdownEditorProps>(function MarkdownEditor(props, ref) {
  return (
    <MilkdownProvider>
      <EditorInner ref={ref} {...props} />
    </MilkdownProvider>
  )
})
