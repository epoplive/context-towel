import { useEffect, useMemo, useState, useCallback, useRef, type CSSProperties } from 'react'
import { MarkdownRenderer, paginateMarkdown } from '@context-towel/markdown'
import { MarkdownEditor } from './MarkdownEditor'
import {
  updateBlockInMarkdown,
  parseMarkdownBlocks,
  registerCoreBlocks,
  registerAllCardPlugins,
  CardThemeProvider,
  CardRenderer,
  TaskCard,
  defaultTheme,
  type BlockEditEvent,
  type BlockInstance,
  type ThemeTokens,
  type TaskData,
  statusColors,
  priorityColors,
} from '@context-towel/card-library'
import { TaskBoardView, type TaskItem, type TaskBoardPrefs } from '@context-towel/context-graph/graph'

// Ensure block types are registered so parseMarkdownBlocks can find task blocks
registerCoreBlocks()
registerAllCardPlugins()
import { ThemeProvider, useTheme, darkTheme, lightTheme } from '@context-towel/context-graph/compat/design-system'
import type { Theme } from '@context-towel/context-graph/compat/design-system'
import { readFileContent, writeFileContent, watchProject } from './tauriFileService'
import { useTypographyStore, initTypography } from './typography-store'
import { FontSettings } from './FontSettings'

// Initialize typography from persisted settings on module load
initTypography()

type ViewMode = 'document' | 'slideshow' | 'board' | 'dependencies' | 'edit'

// ============================================================================
// Planning file detection
// ============================================================================

/** Returns true if the markdown content looks like a planning file. */
function isPlanningFile(content: string): boolean {
  return /^##\s+Phase\s+/m.test(content) && /^[`~]{3}task\b/m.test(content)
}

// ============================================================================
// Task extraction helpers
// ============================================================================

/**
 * Extract all task blocks from markdown content and return their parsed data.
 * Returns an empty array if card plugins are not yet registered (parse will
 * yield no blocks for unknown types).
 */
function extractTaskData(content: string, filePath: string): TaskData[] {
  const { blocks } = parseMarkdownBlocks(content, filePath)
  const result: TaskData[] = []
  for (const block of blocks) {
    if (block.type === 'task' && block.data !== null) {
      result.push(block.data as TaskData)
    }
  }
  return result
}

/** Convert extracted TaskData[] to TaskItem[] for the real TaskBoardView */
function toTaskItems(tasks: TaskData[], filePath: string): TaskItem[] {
  return tasks.map((t, i) => ({
    id: t.id || `task-${i}`,
    title: t.title,
    status: t.status as TaskItem['status'],
    priority: t.priority as TaskItem['priority'],
    category: undefined,
    owner: t.owner,
    activeForm: undefined,
    blockedBy: t.blockedBy ?? [],
    blocks: t.blocks ?? [],
    tags: t.tags ?? [],
    labels: [],
    description: t.description ?? '',
    checklist: t.checklist ?? [],
    log: t.log ?? [],
    notes: t.notes ?? '',
    progress: t.checklist?.length ? Math.round(t.checklist.filter(c => c.checked).length / t.checklist.length * 100) : 0,
    rawContent: '',
    explicitId: t.id || undefined,
    sourceFile: filePath,
    sourceLine: undefined,
  } as TaskItem))
}

// ============================================================================
// Reusable: build a renderCard callback that uses CardRenderer + BlockInstance
// Used by Board tab and slideshow — same cards everywhere
// ============================================================================

function buildBlockRenderCard(
  taskBlocks: BlockInstance[],
  theme: ThemeTokens,
  onEditBlock?: (event: BlockEditEvent) => void,
) {
  const blockById = new Map<string, BlockInstance>()
  for (const block of taskBlocks) {
    const data = block.data as TaskData | null
    if (data?.id) blockById.set(data.id, block)
  }

  return ({ task }: { task: TaskItem }) => {
    const block = blockById.get(task.id)
    if (!block) return null
    return (
      <CardThemeProvider theme={theme}>
        <CardRenderer
          block={block}
          detail="full"
          context="card"
          onEdit={onEditBlock ? (event) => onEditBlock({
            ...event,
            sourcePath: block.source.filePath,
            sourceLine: block.data && typeof block.data === 'object' && 'id' in block.data
              ? (block.data as any).id
              : undefined,
          }) : undefined}
        />
      </CardThemeProvider>
    )
  }
}

// ============================================================================
// Dependencies view — lists tasks with blocked-by relationships
// ============================================================================

interface DependenciesViewProps {
  tasks: TaskData[]
  theme: ThemeTokens
  colors: {
    textPrimary: string
    textSecondary: string
    textMuted: string
    bgSecondary: string
    bgTertiary: string
    borderPrimary: string
    borderSecondary: string
    accent: string
  }
}

function DependenciesView({ tasks, theme, colors }: DependenciesViewProps) {
  if (tasks.length === 0) {
    return (
      <div style={{
        color: theme.textMuted,
        fontSize: 13,
        fontStyle: 'italic',
        padding: 32,
        textAlign: 'center',
      }}>
        No tasks found in this planning file.
      </div>
    )
  }

  // Index tasks by id and title for resolving blocked-by references
  const byId = new Map<string, TaskData>()
  const byTitle = new Map<string, TaskData>()
  for (const t of tasks) {
    if (t.id) byId.set(t.id, t)
    byTitle.set(t.title.toLowerCase(), t)
  }

  const resolveRef = (ref: string): TaskData | undefined => {
    // Strip [[...]] wikilink syntax
    const clean = ref.replace(/^\[\[|\]\]$/g, '').trim()
    return byId.get(clean) ?? byTitle.get(clean.toLowerCase())
  }

  // Separate tasks with deps from those without
  const withDeps = tasks.filter(t => t.blockedBy.length > 0 || t.blocks.length > 0)
  const noDeps = tasks.filter(t => t.blockedBy.length === 0 && t.blocks.length === 0)

  const statusColor = (status: string): string =>
    statusColors[status as keyof typeof statusColors] ?? '#6b7280'

  const priorityColor = (priority: string): string =>
    priorityColors[priority as keyof typeof priorityColors] ?? '#6b7280'

  const renderTask = (task: TaskData) => (
    <div
      key={task.id || task.title}
      style={{
        borderRadius: 6,
        border: `1px solid ${colors.borderPrimary}`,
        background: colors.bgSecondary,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor(task.status),
            flexShrink: 0,
            display: 'inline-block',
          }}
          title={task.status}
        />
        <span style={{ fontWeight: 600, fontSize: 13, color: colors.textPrimary, flex: 1 }}>
          {task.title}
        </span>
        {task.id && (
          <span style={{ fontSize: 10, color: colors.textMuted, fontFamily: 'monospace' }}>
            {task.id}
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '1px 5px',
            borderRadius: 3,
            background: `${priorityColor(task.priority)}22`,
            color: priorityColor(task.priority),
          }}
        >
          {task.priority}
        </span>
      </div>

      {/* Blocked-by */}
      {task.blockedBy.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 16 }}>
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>
            blocked by
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {task.blockedBy.map(ref => {
              const dep = resolveRef(ref)
              return (
                <span
                  key={ref}
                  title={dep ? `${dep.status} — ${dep.title}` : ref}
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 3,
                    border: `1px solid ${dep ? statusColor(dep.status) : colors.borderSecondary}`,
                    color: dep ? statusColor(dep.status) : colors.textMuted,
                    background: dep ? `${statusColor(dep.status)}18` : 'transparent',
                  }}
                >
                  {dep ? dep.title : ref.replace(/^\[\[|\]\]$/g, '')}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Blocks */}
      {task.blocks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 16 }}>
          <span style={{ fontSize: 11, color: colors.accent, fontWeight: 600, flexShrink: 0 }}>
            unblocks
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {task.blocks.map(ref => {
              const dep = resolveRef(ref)
              return (
                <span
                  key={ref}
                  title={dep ? `${dep.status} — ${dep.title}` : ref}
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 3,
                    border: `1px solid ${colors.borderSecondary}`,
                    color: colors.textSecondary,
                  }}
                >
                  {dep ? dep.title : ref.replace(/^\[\[|\]\]$/g, '')}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Tasks with dependency relationships */}
      {withDeps.length > 0 && (
        <section>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: colors.textMuted,
            marginBottom: 10,
          }}>
            Tasks with dependencies ({withDeps.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {withDeps.map(renderTask)}
          </div>
        </section>
      )}

      {/* Tasks with no dependencies */}
      {noDeps.length > 0 && (
        <section>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: colors.textMuted,
            marginBottom: 10,
          }}>
            Independent tasks ({noDeps.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {noDeps.map(renderTask)}
          </div>
        </section>
      )}
    </div>
  )
}

// ============================================================================
// Document TOC — navigable sidebar showing document structure
// ============================================================================

interface TocEntry {
  type: 'heading' | 'task'
  text: string
  level: number
  offset: number
  status?: string
}

interface DocumentTOCProps {
  content: string
  filePath: string
  taskBlocks: BlockInstance[]
  colors: any
}

function DocumentTOC({ content, filePath, taskBlocks, colors }: DocumentTOCProps) {
  const entries = useMemo<TocEntry[]>(() => {
    // Get headings from paginator
    const { headings } = paginateMarkdown(content)
    const result: TocEntry[] = headings.map(h => ({
      type: 'heading' as const,
      text: h.text,
      level: h.level,
      offset: h.startOffset,
    }))

    // Add task blocks
    for (const block of taskBlocks) {
      const data = block.data as TaskData | null
      if (!data) continue
      result.push({
        type: 'task',
        text: data.title,
        level: 3, // indent under headings
        offset: block.source.range.startOffset ?? 0,
        status: data.status,
      })
    }

    // Sort by position in document
    result.sort((a, b) => a.offset - b.offset)
    return result
  }, [content, taskBlocks])

  const scrollTo = useCallback((offset: number) => {
    // Find the nearest rendered element at this offset
    // The MarkdownRenderer renders headings as h1-h6 elements
    const container = document.querySelector('.markdown-body')
    if (!container) return

    // Find all headings and block-cards, pick the one closest to offset
    const elements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, .block-card')
    let closest: Element | null = null
    let closestDist = Infinity

    // Simple heuristic: scroll through elements in order, use index as proxy
    elements.forEach((el, i) => {
      // Use the element's text content to match
      const text = el.textContent?.slice(0, 50) || ''
      const entry = entries.find(e => e.text.startsWith(text.slice(0, 20)) && Math.abs(e.offset - offset) < 100)
      if (entry && Math.abs(entry.offset - offset) < closestDist) {
        closest = el
        closestDist = Math.abs(entry.offset - offset)
      }
    })

    if (closest) {
      (closest as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [entries])

  const statusDot = (status: string) => {
    const color = statusColors[status as keyof typeof statusColors] || '#666'
    return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
  }

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      borderRight: `1px solid ${colors.borderPrimary}`,
      overflow: 'auto',
      padding: '12px 0',
      fontSize: 12,
    }}>
      {entries.map((entry, i) => (
        <div
          key={i}
          onClick={() => scrollTo(entry.offset)}
          style={{
            padding: '3px 12px',
            paddingLeft: `${12 + (entry.level - 1) * 12}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: entry.type === 'heading' ? colors.textPrimary : colors.textSecondary,
            fontWeight: entry.level <= 2 ? 600 : 400,
            fontSize: entry.level === 1 ? 13 : entry.level === 2 ? 12 : 11,
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = colors.bgTertiary }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
        >
          {entry.type === 'task' && entry.status && statusDot(entry.status)}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.text}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Slide content — renders markdown with task clusters as boards
// ============================================================================

type SlideSegment =
  | { type: 'markdown'; content: string }
  | { type: 'task-board'; blocks: BlockInstance[]; filePath: string }

/** Split slide content into markdown segments and task block clusters.
 *  Uses parseMarkdownBlocks (AST-based) instead of regex. */
function splitSlideContent(content: string, filePath: string): SlideSegment[] {
  const { blocks } = parseMarkdownBlocks(content, filePath)
  const taskBlocks = blocks.filter(b => b.type === 'task' && b.data !== null)

  if (taskBlocks.length === 0) {
    return [{ type: 'markdown', content }]
  }

  // Sort by source position
  taskBlocks.sort((a, b) => (a.source.range.startOffset ?? 0) - (b.source.range.startOffset ?? 0))

  const segments: SlideSegment[] = []
  let lastEnd = 0
  let pendingBlocks: BlockInstance[] = []
  let pendingEnd = 0

  for (const block of taskBlocks) {
    const start = block.source.range.startOffset ?? 0
    const end = block.source.range.endOffset ?? start

    // Check if adjacent to previous task block (only whitespace between)
    const gap = content.slice(pendingEnd, start).trim()
    const isAdjacent = pendingBlocks.length > 0 && gap.length === 0

    if (!isAdjacent && pendingBlocks.length > 0) {
      segments.push({ type: 'task-board', blocks: pendingBlocks, filePath })
      pendingBlocks = []
      lastEnd = pendingEnd
    }

    // Emit markdown before this cluster
    if (pendingBlocks.length === 0) {
      const mdBefore = content.slice(lastEnd, start)
      if (mdBefore.trim()) {
        segments.push({ type: 'markdown', content: mdBefore })
      }
    }

    pendingBlocks.push(block)
    pendingEnd = end
  }

  // Flush remaining
  if (pendingBlocks.length > 0) {
    segments.push({ type: 'task-board', blocks: pendingBlocks, filePath })
    lastEnd = pendingEnd
  }

  // Trailing markdown
  const trailing = content.slice(lastEnd)
  if (trailing.trim()) {
    segments.push({ type: 'markdown', content: trailing })
  }

  return segments
}

interface SlideContentProps {
  content: string
  filePath: string
  isPlan: boolean
  theme: ThemeTokens
  isDark: boolean
  colors: any
  onEditBlock?: (event: BlockEditEvent) => void
}

function SlideContent({ content, filePath, isPlan, theme, isDark, colors, onEditBlock }: SlideContentProps) {
  const segments = useMemo(
    () => isPlan ? splitSlideContent(content, filePath) : [{ type: 'markdown' as const, content }],
    [content, filePath, isPlan]
  )

  const boardTheme = theme

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'markdown') {
          return (
            <MarkdownRenderer
              key={i}
              content={seg.content}
              theme={theme}
              isDark={isDark}
              codeBlockMode="highlight"
              uiColors={{ bgOverlay: colors.bgOverlay, buttonBg: colors.buttonBg }}
              onEditBlock={onEditBlock}
            />
          )
        }

        // Task board segment — same TaskBoardView as the Board tab
        const segTaskItems = toTaskItems(
          seg.blocks.map(b => b.data as TaskData).filter(Boolean),
          seg.filePath
        )
        return (
          <div key={i} style={{ margin: '1em 0' }}>
            <TaskBoardView
              tasks={segTaskItems}
              parentDocId={seg.filePath}
              taskListId={`slide-board-${i}`}
              renderCard={buildBlockRenderCard(seg.blocks, boardTheme, onEditBlock)}
            />
          </div>
        )
      })}
    </>
  )
}

// ============================================================================
// Layout constants
// ============================================================================

function loadPrefs(): { isDark: boolean } {
  try {
    const stored = localStorage.getItem('context-towel-viewer-prefs')
    if (stored) {
      const parsed = JSON.parse(stored)
      return { isDark: parsed.isDark ?? true }
    }
  } catch {}
  return { isDark: true }
}

function savePrefs(prefs: { isDark: boolean }) {
  try { localStorage.setItem('context-towel-viewer-prefs', JSON.stringify(prefs)) } catch {}
}

interface SmartSlide {
  title: string
  level: number
  content: string
}

const MAX_SLIDE_SIZE = 4000

interface FileViewerInnerProps {
  filePath: string
  onBack: () => void
  onToggleTheme: () => void
}

function FileViewerInner({ filePath, onBack, onToggleTheme }: FileViewerInnerProps) {
  const { colors, typography, radius, isDark } = useTheme()
  const fontSize = useTypographyStore((state) => state.fontSize)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('document')
  const [currentPage, setCurrentPage] = useState(0)
  const isPlan = content !== null && isPlanningFile(content)
  const [presentationMode, setPresentationMode] = useState(false)
  const unwatchRef = useRef<(() => void) | null>(null)
  const contentRef = useRef<string | null>(null)
  // Keep contentRef in sync for onEditBlock closure
  useEffect(() => { contentRef.current = content }, [content])
  // True while the WYSIWYG editor is open — suppresses watcher re-renders that would fight the editor
  const isEditingRef = useRef(false)
  // Debounce timer for auto-save from editor onChange
  const editSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fileName = filePath.split('/').pop() ?? filePath

  const markdownTheme = useMemo<ThemeTokens>(() => ({
    bgPrimary: colors.bgPrimary,
    bgSecondary: colors.bgSecondary,
    bgTertiary: colors.bgTertiary,
    borderPrimary: colors.borderPrimary,
    borderSecondary: colors.borderSecondary,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    textInverse: colors.textInverse,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    fontMono: typography.fontFamily.mono,
    fontSans: typography.fontFamily.sans,
    radius: radius.md,
  }), [colors, typography, radius])

  // Load file content
  useEffect(() => {
    let cancelled = false
    readFileContent(filePath).then(text => {
      if (!cancelled && text !== null) setContent(text)
    })
    return () => { cancelled = true }
  }, [filePath])

  // Watch for file changes
  useEffect(() => {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    if (!dir) return

    let unsub: (() => void) | null = null

    watchProject(dir, async (changedPaths) => {
      // Don't fight the WYSIWYG editor: skip watcher updates while editing
      if (isEditingRef.current) return
      for (const p of changedPaths) {
        if (p === filePath || p.endsWith('/' + fileName)) {
          const text = await readFileContent(filePath)
          if (text !== null) setContent(text)
        }
      }
    }).then(fn => { unsub = fn })

    return () => { unsub?.() }
  }, [filePath, fileName])

  // onEditBlock — handles card edit events (checkbox toggle, etc.)
  // Patches the markdown source and writes back to file
  const handleEditBlock = useCallback(async (event: BlockEditEvent) => {
    const currentContent = contentRef.current
    if (!currentContent) return

    // Parse all blocks in current content to find the one being edited
    const { blocks } = parseMarkdownBlocks(currentContent, filePath)

    // Match by block ID (carried in event.sourceLine for task blocks)
    // or fall back to type-only match for blocks without IDs
    const blockId = event.sourceLine
    const matchingBlock = blockId != null
      ? blocks.find(b => b.type === event.blockType && b.data && (b.data as any).id === blockId)
      : blocks.find(b => b.type === event.blockType)
    if (!matchingBlock) return

    // Convert dot-separated field path to array path for BlockUpdate
    const path = event.field.split('.').map(segment => {
      const num = Number(segment)
      return Number.isNaN(num) ? segment : num
    })

    const { content: patched, errors } = updateBlockInMarkdown(
      currentContent,
      matchingBlock,
      [{ path, value: event.value }]
    )

    if (errors.length > 0) {
      console.error('[FileViewer] Block update errors:', errors)
      return
    }

    // Update local state immediately for responsive feel
    setContent(patched)
    // Write back to file — the watcher will also pick this up
    await writeFileContent(filePath, patched)
  }, [filePath])

  // handleEditorChange — called by MarkdownEditor on every keystroke, debounced to 500ms before writing
  const handleEditorChange = useCallback((markdown: string) => {
    setContent(markdown)
    if (editSaveTimerRef.current !== null) {
      clearTimeout(editSaveTimerRef.current)
    }
    editSaveTimerRef.current = setTimeout(async () => {
      editSaveTimerRef.current = null
      await writeFileContent(filePath, markdown)
    }, 500)
  }, [filePath])

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => { unwatchRef.current?.() }
  }, [])

  // Build slides for slideshow mode
  const slides = useMemo<SmartSlide[]>(() => {
    if (!content) return [{ title: 'Loading...', level: 1, content: '' }]
    try {
      const { pages, headings } = paginateMarkdown(content, {
        maxChars: MAX_SLIDE_SIZE,
        targetChars: 2600,
        minChars: 900,
      })

      const resolveHeadingContext = (startOffset: number) => {
        let active: { text: string; level: number } | null = null
        for (const h of headings) {
          if (h.startOffset <= startOffset) active = { text: h.text, level: h.level }
          else break
        }
        return active
      }

      const firstHeadingInRange = (startOffset: number, endOffset: number) => {
        for (const h of headings) {
          if (h.startOffset >= startOffset && h.startOffset < endOffset) return { text: h.text, level: h.level }
        }
        return null
      }

      let prevBaseTitle = ''
      return pages.map((p, index) => {
        const ownHeading = firstHeadingInRange(p.startOffset, p.endOffset)
        const ctxHeading = ownHeading ?? resolveHeadingContext(p.startOffset)

        const baseTitle = ctxHeading?.text || 'Document'
        const level = ctxHeading?.level || 1
        const isContinuation = !ownHeading && index > 0 && baseTitle === prevBaseTitle
        prevBaseTitle = baseTitle

        return {
          title: isContinuation ? `${baseTitle} (cont.)` : baseTitle,
          level,
          content: p.content,
        }
      })
    } catch {
      return [{ title: 'Document', level: 1, content: content || '' }]
    }
  }, [content])

  // Clamp page when slides change
  useEffect(() => {
    setCurrentPage(p => Math.min(p, Math.max(0, slides.length - 1)))
  }, [slides.length])

  // Reset view mode to 'document' when the file changes
  useEffect(() => {
    setViewMode('document')
  }, [filePath])

  // Keep isEditingRef in sync with viewMode
  useEffect(() => {
    isEditingRef.current = viewMode === 'edit'
    // Cancel any pending save when leaving edit mode
    if (viewMode !== 'edit' && editSaveTimerRef.current !== null) {
      clearTimeout(editSaveTimerRef.current)
      editSaveTimerRef.current = null
    }
  }, [viewMode])

  // Tasks extracted from planning files (only computed when needed)
  const planningTasks = useMemo<TaskData[]>(() => {
    if (!content || !isPlanningFile(content)) return []
    return extractTaskData(content, filePath)
  }, [content, filePath])

  // Actual BlockInstance objects for task blocks — used by BoardView for CardRenderer
  const taskBlocks = useMemo<BlockInstance[]>(() => {
    if (!content || !isPlanningFile(content)) return []
    const { blocks } = parseMarkdownBlocks(content, filePath)
    return blocks.filter(b => b.type === 'task' && b.data !== null)
  }, [content, filePath])

  const taskItems = useMemo(() => toTaskItems(planningTasks, filePath), [planningTasks, filePath])

  const [boardPrefs, setBoardPrefs] = useState<TaskBoardPrefs>({ view: 'board', groupBy: 'status' })

  // Keyboard navigation for slideshow (normal + presentation mode)
  useEffect(() => {
    if (viewMode !== 'slideshow') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setCurrentPage(p => Math.min(p + 1, slides.length - 1))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace') {
        e.preventDefault()
        setCurrentPage(p => Math.max(p - 1, 0))
      }
      if (e.key === 'Escape' && presentationMode) {
        exitPresentation()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [viewMode, slides.length, presentationMode])

  // Sync presentationMode if the user exits fullscreen via browser chrome
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && presentationMode) {
        setPresentationMode(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [presentationMode])

  const enterPresentation = useCallback(() => {
    document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen may be denied (e.g. in some embedded contexts); still show the overlay
    })
    setPresentationMode(true)
  }, [])

  const exitPresentation = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    setPresentationMode(false)
  }, [])

  const slide = slides[currentPage] || slides[0]
  const totalPages = slides.length


  if (content === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: colors.textMuted,
        fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  // Presentation mode overlay — full viewport, dark background, single centered slide
  if (presentationMode && slide) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#0d0d0d',
          color: '#e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
        }}
      >
        {/* Left nav arrow */}
        <button
          onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
          disabled={currentPage === 0}
          style={{
            position: 'absolute',
            left: 24,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: currentPage === 0 ? '#444' : '#888',
            fontSize: 32,
            cursor: currentPage === 0 ? 'default' : 'pointer',
            padding: '8px 12px',
            lineHeight: 1,
          }}
          title="Previous slide (← or Backspace)"
        >
          ‹
        </button>

        {/* Slide content */}
        <div
          style={{
            maxWidth: 1100,
            width: '100%',
            maxHeight: '100vh',
            overflow: 'auto',
            padding: '60px 80px',
            boxSizing: 'border-box',
          }}
        >
          {slide.content.trim() ? (
            <MarkdownRenderer
              content={slide.content}
              theme={markdownTheme}
              isDark={true}
              codeBlockMode="highlight"
              uiColors={{ bgOverlay: colors.bgOverlay, buttonBg: colors.buttonBg }}
              onEditBlock={handleEditBlock}
            />
          ) : (
            <div style={{ color: '#555', fontStyle: 'italic', textAlign: 'center', fontSize: '0.65em' }}>
              This section has no content
            </div>
          )}
        </div>

        {/* Right nav arrow */}
        <button
          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
          disabled={currentPage === totalPages - 1}
          style={{
            position: 'absolute',
            right: 24,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: currentPage === totalPages - 1 ? '#444' : '#888',
            fontSize: 32,
            cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
            padding: '8px 12px',
            lineHeight: 1,
          }}
          title="Next slide (→ or Space)"
        >
          ›
        </button>

        {/* Exit (X) button */}
        <button
          onClick={exitPresentation}
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            background: 'none',
            border: 'none',
            color: '#666',
            fontSize: 22,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '4px 8px',
          }}
          title="Exit presentation (Esc)"
        >
          ✕
        </button>

        {/* Slide counter */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 24,
            color: '#555',
            fontSize: '0.5em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {currentPage + 1}/{totalPages}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: colors.bgPrimary,
      color: colors.textPrimary,
      position: 'relative',
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${colors.borderPrimary}`,
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        userSelect: 'none',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: 14,
            padding: '2px 6px',
          }}
          title="Back"
        >
          ←
        </button>

        <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </strong>

        {/* Typography settings button */}
        <button
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            background: settingsOpen ? colors.accent : 'none',
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 6,
            color: settingsOpen ? colors.textInverse : colors.textSecondary,
            cursor: 'pointer',
            fontSize: 13,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Typography settings"
        >
          Aa
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          style={{
            background: 'none',
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 6,
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: 13,
            padding: '4px 10px',
          }}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? 'Light' : 'Dark'}
        </button>

        {/* View mode toggle */}
        <div style={{ display: 'flex', border: `1px solid ${colors.borderSecondary}`, borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => setViewMode('document')}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'document' ? colors.accent : 'transparent',
              color: viewMode === 'document' ? colors.textInverse : colors.textSecondary,
            }}
          >
            Document
          </button>
          <button
            onClick={() => setViewMode('slideshow')}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'slideshow' ? colors.accent : 'transparent',
              color: viewMode === 'slideshow' ? colors.textInverse : colors.textSecondary,
            }}
          >
            Slideshow
          </button>
          <button
            onClick={() => setViewMode('edit')}
            style={{
              border: 'none',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'edit' ? colors.accent : 'transparent',
              color: viewMode === 'edit' ? colors.textInverse : colors.textSecondary,
            }}
          >
            Edit
          </button>
          {isPlan && (
            <button
              onClick={() => setViewMode('board')}
              style={{
                border: 'none',
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'board' ? colors.accent : 'transparent',
                color: viewMode === 'board' ? colors.textInverse : colors.textSecondary,
              }}
            >
              Board
            </button>
          )}
          {isPlan && (
            <button
              onClick={() => setViewMode('dependencies')}
              style={{
                border: 'none',
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'dependencies' ? colors.accent : 'transparent',
                color: viewMode === 'dependencies' ? colors.textInverse : colors.textSecondary,
              }}
            >
              Deps
            </button>
          )}
        </div>

        {/* Present button — only in slideshow mode */}
        {viewMode === 'slideshow' && (
          <button
            onClick={enterPresentation}
            style={{
              background: 'none',
              border: `1px solid ${colors.borderSecondary}`,
              borderRadius: 6,
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
            }}
            title="Enter presentation mode"
          >
            Present
          </button>
        )}

        {/* Slideshow page counter in toolbar */}
        {viewMode === 'slideshow' && totalPages > 1 && (
          <span style={{ color: colors.textMuted, fontSize: 11 }}>
            {currentPage + 1}/{totalPages}
          </span>
        )}
      </div>

      {/* FontSettings slide-out panel */}
      {settingsOpen && (
        <div style={{
          position: 'absolute' as CSSProperties['position'],
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          background: colors.bgSecondary,
          borderLeft: `1px solid ${colors.borderPrimary}`,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderBottom: `1px solid ${colors.borderPrimary}`,
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Typography Settings</span>
            <button
              onClick={() => setSettingsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: 18,
                padding: '2px 6px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <FontSettings />
          </div>
        </div>
      )}

      {/* Content area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 0,
      }}>
        {viewMode === 'edit' ? (
          <div style={{ fontSize: `${fontSize}px`, padding: '0 24px' }}>
            <MarkdownEditor
              content={content}
              onChange={handleEditorChange}
              placeholder="Start writing..."
            />
          </div>
        ) : viewMode === 'document' ? (
          <div style={{ display: 'flex', gap: 0, height: '100%' }}>
            {/* TOC Sidebar */}
            <DocumentTOC content={content} filePath={filePath} taskBlocks={taskBlocks} colors={colors} />
            {/* Document content */}
            <div style={{ flex: 1, fontSize: `${fontSize}px`, padding: '16px 24px', overflow: 'auto', minWidth: 0 }}>
              <MarkdownRenderer
                content={content}
                theme={markdownTheme}
                isDark={isDark}
                codeBlockMode="highlight"
                uiColors={{ bgOverlay: colors.bgOverlay, buttonBg: colors.buttonBg }}
                onEditBlock={handleEditBlock}
              />
            </div>
          </div>
        ) : viewMode === 'board' ? (
          <TaskBoardView
            tasks={taskItems}
            parentDocId={filePath}
            taskListId="viewer"
            prefs={boardPrefs}
            onPrefsChange={(updates) => setBoardPrefs(p => ({ ...p, ...updates }))}
            renderCard={buildBlockRenderCard(taskBlocks, markdownTheme, handleEditBlock)}
          />
        ) : viewMode === 'dependencies' ? (
          <DependenciesView tasks={planningTasks} theme={markdownTheme} colors={colors} />
        ) : (
          /* Slideshow mode — TOC sidebar + slide content */
          slide ? (
            <div style={{ display: 'flex', gap: 0, height: '100%' }}>
              {/* Slide TOC */}
              <div style={{
                width: 220,
                flexShrink: 0,
                borderRight: `1px solid ${colors.borderPrimary}`,
                overflow: 'auto',
                padding: '8px 0',
                fontSize: 11,
              }}>
                {slides.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentPage(idx)}
                    style={{
                      padding: '6px 12px',
                      paddingLeft: `${12 + (s.level - 1) * 8}px`,
                      cursor: 'pointer',
                      background: idx === currentPage ? `${colors.accent}22` : 'transparent',
                      borderLeft: idx === currentPage ? `2px solid ${colors.accent}` : '2px solid transparent',
                      color: idx === currentPage ? colors.textPrimary : colors.textSecondary,
                      fontWeight: s.level <= 2 ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { if (idx !== currentPage) (e.currentTarget as HTMLElement).style.background = colors.bgTertiary }}
                    onMouseLeave={(e) => { if (idx !== currentPage) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {s.title}
                  </div>
                ))}
              </div>

              {/* Slide content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', minWidth: 0 }}>
                {slide.content.trim() ? (
                  <SlideContent
                    content={slide.content}
                    filePath={filePath}
                    isPlan={isPlan}
                    theme={markdownTheme}
                    isDark={isDark}
                    colors={colors}
                    onEditBlock={handleEditBlock}
                  />
                ) : (
                  <div style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic', padding: 16, textAlign: 'center' }}>
                    This section has no content
                  </div>
                )}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

export interface FileViewerProps {
  filePath: string
  onBack: () => void
}

export function FileViewer({ filePath, onBack }: FileViewerProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const prefs = loadPrefs()
    return prefs.isDark ? darkTheme : lightTheme
  })

  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t.isDark ? lightTheme : darkTheme
      savePrefs({ isDark: next.isDark })
      return next
    })
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <FileViewerInner
        filePath={filePath}
        onBack={onBack}
        onToggleTheme={toggleTheme}
      />
    </ThemeProvider>
  )
}
