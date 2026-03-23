import {
  parseMarkdownBlocks,
  CardThemeProvider,
  CardRenderer,
  type BlockEditEvent,
  type BlockInstance,
  type ThemeTokens,
  type TaskData,
} from '@context-towel/card-library'
import type { TaskItem } from '@context-towel/context-graph/graph'

/** Returns true if the markdown content looks like a planning file. */
export function isPlanningFile(content: string): boolean {
  return /^##\s+Phase\s+/m.test(content) && /^[`~]{3}task\b/m.test(content)
}

/**
 * Extract all task blocks from markdown content and return their parsed data.
 */
export function extractTaskData(content: string, filePath: string): TaskData[] {
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
export function toTaskItems(tasks: TaskData[], filePath: string): TaskItem[] {
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

/**
 * Build a renderCard callback that uses CardRenderer + BlockInstance.
 * Used by Board tab and slideshow — same cards everywhere.
 */
export function buildBlockRenderCard(
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
            blockId: block.data && typeof block.data === 'object' && 'id' in block.data
              ? (block.data as TaskData).id
              : undefined,
          }) : undefined}
        />
      </CardThemeProvider>
    )
  }
}

export type SlideSegment =
  | { type: 'markdown'; content: string }
  | { type: 'task-board'; blocks: BlockInstance[]; filePath: string }

/** Split slide content into markdown segments and task block clusters.
 *  Uses parseMarkdownBlocks (AST-based) instead of regex. */
export function splitSlideContent(content: string, filePath: string): SlideSegment[] {
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
