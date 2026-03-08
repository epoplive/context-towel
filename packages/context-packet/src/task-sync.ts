// ============================================================================
// Task Sync — Bidirectional task linking between packets and plan files
// ============================================================================

import { parseMarkdownBlocks, replaceBlockInMarkdown } from '@context-towel/card-library'
import type { BlockInstance } from '@context-towel/card-library'
import type { FileService } from './types'

/** Minimal task data shape for sync operations */
export interface TaskSyncData {
  id: string
  title: string
  status: string
  priority: string
  category?: string
  owner?: string
  activeForm?: string
  blockedBy: string[]
  blocks: string[]
  tags: string[]
  description: string
  checklist: { text: string; checked: boolean }[]
  log: { timestamp: string; entry: string }[]
  notes: string
}

export interface TaskSyncResult {
  success: boolean
  error?: string
}

// ── Task Serializer ───────────────────────────────────────────────

/**
 * Serialize a TaskData-like object back to the raw task block format.
 * Produces the INNER content (without fence markers).
 */
export function serializeTaskBlock(task: TaskSyncData): string {
  const lines: string[] = []

  if (task.id && task.id !== 'task') lines.push(`id: ${task.id}`)
  lines.push(`title: ${task.title}`)
  lines.push(`status: ${task.status}`)
  lines.push(`priority: ${task.priority}`)

  if (task.category) lines.push(`category: ${task.category}`)
  if (task.owner) lines.push(`owner: ${task.owner}`)
  if (task.activeForm) lines.push(`active-form: ${task.activeForm}`)

  if (task.tags.length > 0) {
    lines.push(`tags: ${task.tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}`)
  }

  if (task.blockedBy.length > 0) {
    lines.push(`blocked-by: ${task.blockedBy.map(id => `[[${id}]]`).join(', ')}`)
  }

  if (task.blocks.length > 0) {
    lines.push(`blocks: ${task.blocks.map(id => `[[${id}]]`).join(', ')}`)
  }

  if (task.description) {
    lines.push(`description: |`)
    for (const line of task.description.split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  if (task.checklist.length > 0) {
    lines.push(`checklist:`)
    for (const item of task.checklist) {
      lines.push(`  - [${item.checked ? 'x' : ' '}] ${item.text}`)
    }
  }

  if (task.log.length > 0) {
    lines.push(`log:`)
    for (const entry of task.log) {
      lines.push(`  - [${entry.timestamp}] ${entry.entry}`)
    }
  }

  if (task.notes) {
    lines.push(`notes: |`)
    for (const line of task.notes.split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  return lines.join('\n')
}

// ── Block Finder ──────────────────────────────────────────────────

/**
 * Find a task block by ID in a markdown file's content.
 * Re-parses each time to get fresh offsets.
 */
export function findTaskBlockById(
  content: string,
  filePath: string,
  taskId: string,
): BlockInstance | null {
  const { blocks } = parseMarkdownBlocks(content, filePath)
  return blocks.find(
    b => b.type === 'task' && b.data && (b.data as { id?: string }).id === taskId
  ) ?? null
}

/**
 * Extract all task blocks from markdown content with their IDs.
 */
export function extractTaskBlocks(
  content: string,
  filePath: string,
): { block: BlockInstance; taskId: string }[] {
  const { blocks } = parseMarkdownBlocks(content, filePath)
  const result: { block: BlockInstance; taskId: string }[] = []

  for (const block of blocks) {
    if (block.type === 'task' && block.data) {
      const id = (block.data as { id?: string }).id
      if (id) {
        result.push({ block, taskId: id })
      }
    }
  }

  return result
}

// ── Sync Operations ───────────────────────────────────────────────

/**
 * Sync a task update back to its source file.
 *
 * 1. Re-reads the source file for fresh content
 * 2. Re-parses to find the task block by ID (fresh offsets)
 * 3. Serializes the updated task data
 * 4. Uses replaceBlockInMarkdown to swap the block in-place
 * 5. Writes back to the source file
 */
export async function syncTaskToSourceFile(
  fs: FileService,
  sourceFile: string,
  taskId: string,
  updatedTask: TaskSyncData,
): Promise<TaskSyncResult> {
  // Read current source content
  let content: string
  try {
    content = await fs.read(sourceFile)
  } catch {
    return { success: false, error: `Cannot read source file: ${sourceFile}` }
  }

  // Find the task block by ID with fresh offsets
  const block = findTaskBlockById(content, sourceFile, taskId)
  if (!block) {
    return { success: false, error: `Task "${taskId}" not found in ${sourceFile}` }
  }

  // Serialize the updated task
  const serialized = serializeTaskBlock(updatedTask)

  // Replace the block in the content
  const updated = replaceBlockInMarkdown(content, block, serialized)

  // Write back
  await fs.write(sourceFile, updated)

  return { success: true }
}

/**
 * Build a task source map from a plan file.
 * Maps each task's ID to the source file path.
 */
export function buildTaskSourceMap(
  content: string,
  filePath: string,
): Record<string, string> {
  const tasks = extractTaskBlocks(content, filePath)
  const map: Record<string, string> = {}
  for (const { taskId } of tasks) {
    map[taskId] = filePath
  }
  return map
}
