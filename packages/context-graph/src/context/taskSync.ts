// ============================================================================
// Claude Task Sync - Sync context graph tasks into Claude task lists
// ============================================================================

import { fileService as defaultFileService } from '../compat/services'
import { normalizeProjectPath } from '../compat/projectIdentity'
import type { WorkspaceState, ParsedDocument } from '../types'
import type { TaskItem } from '../plugins/task/types'
import { buildTaskIndex, resolveTaskRefList } from '../plugins/task/idUtils'
import { useGraphStore } from '../state'
import { buildWorkspaceStateFromGraph } from './autoWriter'

export type ClaudeTaskStatus = 'pending' | 'in_progress' | 'completed'

export interface ClaudeTaskRecord {
  id: string
  subject: string
  description: string
  status: ClaudeTaskStatus
  blocks: string[]
  blockedBy: string[]
  activeForm?: string
  owner?: string
  metadata?: Record<string, unknown>
}

export type TaskSyncDeps = {
  fileService?: Pick<typeof defaultFileService, 'exists' | 'read' | 'write' | 'list' | 'mkdir' | 'remove' | 'stat'>
  resolveTaskListId?: (projectPath: string) => string
  includeDocument?: (doc: ParsedDocument, projectPath: string) => boolean
  debounceMs?: number
}

export type TaskSyncResult = {
  taskListId: string
  created: number
  updated: number
  removed: number
  skipped: number
  duplicates: string[]
}

const DEFAULT_TASKS_ROOT = '~/.claude/tasks'

const slugify = (value: string): string => {
  const trimmed = value.trim().toLowerCase()
  const slug = trimmed.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'project'
}

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const defaultResolveTaskListId = (projectPath: string): string => {
  const normalized = normalizeProjectPath(projectPath) ?? projectPath
  const baseName = normalized.split('/').filter(Boolean).pop() || 'project'
  return `lg_tasks_${slugify(baseName)}_${fnv1a(normalized)}`
}

const defaultIncludeDocument = (doc: ParsedDocument, projectPath: string): boolean => {
  const normalizedProject = normalizeProjectPath(projectPath)
  if (!normalizedProject) return false
  const normalizedPath = doc.path.replace(/\\/g, '/')
  const workingRoot = `${normalizedProject}/.context/working`
  return normalizedPath.startsWith(workingRoot)
}

const statusMap: Record<TaskItem['status'], ClaudeTaskStatus> = {
  'todo': 'pending',
  'in-progress': 'in_progress',
  'blocked': 'pending',
  'done': 'completed',
}

const priorityMap: Record<TaskItem['priority'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function formatChecklist(items: TaskItem['checklist']): string[] {
  if (items.length === 0) return []
  return [
    'Checklist:',
    ...items.map(item => `- [${item.checked ? 'x' : ' '}] ${item.text}`),
  ]
}

function formatLog(entries: TaskItem['log']): string[] {
  if (entries.length === 0) return []
  return [
    'Log:',
    ...entries.map(entry => `- [${entry.timestamp}] ${entry.entry}`),
  ]
}

function formatTaskDescription(task: TaskItem): string {
  const lines: string[] = []

  if (task.description) {
    lines.push(task.description.trim())
  }

  if (task.checklist.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(...formatChecklist(task.checklist))
  }

  if (task.notes) {
    if (lines.length > 0) lines.push('')
    lines.push('Notes:')
    lines.push(task.notes.trim())
  }

  if (task.log.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(...formatLog(task.log.slice(-5)))
  }

  if (task.tags.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(`Tags: ${task.tags.map(tag => `#${tag}`).join(' ')}`)
  }

  if (task.sourceFile) {
    const source = task.sourceLine
      ? `${task.sourceFile}:${task.sourceLine}`
      : task.sourceFile
    if (lines.length > 0) lines.push('')
    lines.push(`Source: ${source}`)
  }

  const description = lines.join('\n').trim()
  return description.length > 0 ? description : task.title
}

function collectTasks(state: WorkspaceState, projectPath: string, includeDocument: (doc: ParsedDocument, projectPath: string) => boolean): TaskItem[] {
  const tasks: TaskItem[] = []
  state.documents.forEach((doc) => {
    if (!includeDocument(doc, projectPath)) return
    const taskResult = doc.extractions.get('task')
    if (!taskResult?.items?.length) return
    tasks.push(...(taskResult.items as TaskItem[]))
  })
  return tasks
}

function buildDependencyIndex(
  tasks: TaskItem[],
  resolvedBlockedByById: Map<string, string[]>
): Map<string, string[]> {
  const blocksById = new Map<string, Set<string>>()
  const taskIds = new Set(tasks.map(task => task.id))

  for (const task of tasks) {
    const deps = resolvedBlockedByById.get(task.id) ?? []
    for (const dep of deps) {
      if (!taskIds.has(dep)) continue
      const existing = blocksById.get(dep)
      if (existing) {
        existing.add(task.id)
      } else {
        blocksById.set(dep, new Set([task.id]))
      }
    }
  }

  const resolved = new Map<string, string[]>()
  blocksById.forEach((set, id) => {
    resolved.set(id, Array.from(set))
  })
  return resolved
}

function toClaudeTask(
  task: TaskItem,
  blocks: string[],
  blockedBy: string[],
  projectPath: string
): ClaudeTaskRecord {
  const normalizedProject = normalizeProjectPath(projectPath) ?? projectPath

  const metadata: Record<string, unknown> = {
    priority: priorityMap[task.priority],
    labels: task.tags.length > 0 ? task.tags : undefined,
    category: task.category || undefined,
    lookingGlass: {
      source: 'context-graph',
      projectPath: normalizedProject,
      taskId: task.id,
      sourceFile: task.sourceFile,
      sourceLine: task.sourceLine,
    },
  }

  Object.keys(metadata).forEach((key) => {
    if (metadata[key] === undefined) delete metadata[key]
  })

  return {
    id: task.id,
    subject: task.title,
    description: formatTaskDescription(task),
    status: statusMap[task.status],
    blocks,
    blockedBy,
    activeForm: task.activeForm || undefined,
    owner: task.owner || undefined,
    metadata,
  }
}

export async function syncClaudeTasks(
  projectPath: string,
  state: WorkspaceState,
  deps: TaskSyncDeps = {}
): Promise<TaskSyncResult> {
  const fs = deps.fileService ?? defaultFileService
  const normalizedProject = normalizeProjectPath(projectPath)
  const includeDocument = deps.includeDocument ?? defaultIncludeDocument
  const taskListId = (deps.resolveTaskListId ?? defaultResolveTaskListId)(projectPath)

  const result: TaskSyncResult = {
    taskListId,
    created: 0,
    updated: 0,
    removed: 0,
    skipped: 0,
    duplicates: [],
  }

  if (!normalizedProject) return result

  const tasks = collectTasks(state, normalizedProject, includeDocument)

  const uniqueTasks = new Map<string, TaskItem>()
  for (const task of tasks) {
    if (uniqueTasks.has(task.id)) {
      result.duplicates.push(task.id)
      continue
    }
    uniqueTasks.set(task.id, task)
  }

  const taskList = Array.from(uniqueTasks.values())
  const index = buildTaskIndex(taskList)
  const resolvedBlockedByById = new Map<string, string[]>()
  const resolvedBlocksById = new Map<string, string[]>()
  taskList.forEach(task => {
    resolvedBlockedByById.set(task.id, resolveTaskRefList(task.blockedBy ?? [], task, index))
    resolvedBlocksById.set(task.id, resolveTaskRefList(task.blocks ?? [], task, index))
  })

  const blocksIndex = buildDependencyIndex(taskList, resolvedBlockedByById)

  const tasksRootExists = await fs.exists(DEFAULT_TASKS_ROOT)
  if (!tasksRootExists) {
    await fs.mkdir(DEFAULT_TASKS_ROOT)
  }
  const listDir = `${DEFAULT_TASKS_ROOT}/${taskListId}`
  if (!(await fs.exists(listDir))) {
    await fs.mkdir(listDir)
  }

  const entries = await fs.list(listDir)
  const existingFiles = entries.filter(entry => !entry.is_dir && entry.name.endsWith('.json'))

  const managedTasks = new Map<string, { path: string; record: ClaudeTaskRecord }>()
  for (const entry of existingFiles) {
    try {
      const content = await fs.read(entry.path)
      const parsed = JSON.parse(content) as ClaudeTaskRecord
      const lookingGlass = parsed.metadata && (parsed.metadata as any).lookingGlass
      if (!lookingGlass || lookingGlass.source !== 'context-graph') continue
      if (lookingGlass.projectPath !== normalizedProject) continue
      if (!lookingGlass.taskId) continue
      managedTasks.set(String(lookingGlass.taskId), { path: entry.path, record: parsed })
    } catch {
      continue
    }
  }

  const desiredIds = new Set<string>()

  for (const task of uniqueTasks.values()) {
    const resolvedBlocks = resolvedBlocksById.get(task.id) ?? []
    const resolvedBlockedBy = resolvedBlockedByById.get(task.id) ?? []
    const blocks = Array.from(new Set([...(resolvedBlocks ?? []), ...(blocksIndex.get(task.id) ?? [])]))
    const record = toClaudeTask(task, blocks, resolvedBlockedBy, normalizedProject)
    desiredIds.add(task.id)

    const existing = managedTasks.get(task.id)
    const nextPayload = JSON.stringify(record, null, 2)
    if (existing) {
      const prevPayload = JSON.stringify(existing.record, null, 2)
      if (prevPayload !== nextPayload) {
        await fs.write(existing.path, nextPayload)
        result.updated += 1
      }
      continue
    }

    const targetPath = `${listDir}/${task.id}.json`
    if (await fs.exists(targetPath)) {
      result.skipped += 1
      continue
    }

    await fs.write(targetPath, nextPayload)
    result.created += 1
  }

  for (const [taskId, existing] of managedTasks.entries()) {
    if (desiredIds.has(taskId)) continue
    await fs.remove(existing.path)
    result.removed += 1
  }

  return result
}

export function createTaskAutoWriter(deps: TaskSyncDeps = {}) {
  const debounceMs = deps.debounceMs ?? 1200

  return {
    start(projectPath: string | null): () => void {
      if (!projectPath) return () => {}
      const normalizedProject = normalizeProjectPath(projectPath)
      if (!normalizedProject) return () => {}

      let cancelled = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      const schedule = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(() => {
          timeoutId = null
          void runSync()
        }, debounceMs)
      }

      const runSync = async () => {
        if (cancelled) return
        const snapshot = useGraphStore.getState()
        const storeProject = normalizeProjectPath(snapshot.projectPath)
        if (!storeProject || storeProject !== normalizedProject) {
          return
        }
        const workspaceState = buildWorkspaceStateFromGraph(snapshot)
        await syncClaudeTasks(normalizedProject, workspaceState, deps)
      }

      const unsubscribe = useGraphStore.subscribe(
        (state) => ({
          projectPath: state.projectPath,
          treeItems: state.treeItems,
          docContents: state.docContents,
          focusedNode: state.focusedNode,
          customFocusNodes: state.customFocusNodes,
          expandedPanel: state.expandedPanel,
          expandedPanels: state.expandedPanels,
          collapsedFolders: state.collapsedFolders,
          treeWidgetFolders: state.treeWidgetFolders,
          quickPreviewNode: state.quickPreviewNode,
          cardScale: state.cardScale,
        }),
        schedule,
        {
          equalityFn: (a, b) => (
            a.projectPath === b.projectPath &&
            a.treeItems === b.treeItems &&
            a.docContents === b.docContents &&
            a.focusedNode === b.focusedNode &&
            a.customFocusNodes === b.customFocusNodes &&
            a.expandedPanel === b.expandedPanel &&
            a.expandedPanels === b.expandedPanels &&
            a.collapsedFolders === b.collapsedFolders &&
            a.treeWidgetFolders === b.treeWidgetFolders &&
            a.quickPreviewNode === b.quickPreviewNode &&
            a.cardScale === b.cardScale
          ),
        }
      )

      schedule()

      return () => {
        cancelled = true
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
        unsubscribe()
      }
    },
  }
}
