import type { TaskItem } from './types'

const TASK_ID_SEPARATOR = '__'

export function normalizeTaskId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getTaskFilePrefix(sourceFile: string | undefined): string {
  if (!sourceFile) return ''
  const normalizedPath = sourceFile.replace(/\\/g, '/')
  const marker = '/.context/'
  const markerIndex = normalizedPath.lastIndexOf(marker)
  const stablePath = markerIndex >= 0
    ? normalizedPath.slice(markerIndex + 1)
    : normalizedPath
  const withoutExt = stablePath.replace(/\.[^/.]+$/, '')
  return normalizeTaskId(withoutExt)
}

export function buildImplicitTaskId(title: string, sourceFile: string | undefined): string {
  const localId = normalizeTaskId(title) || 'task'
  const prefix = getTaskFilePrefix(sourceFile)
  return prefix ? `${prefix}${TASK_ID_SEPARATOR}${localId}` : localId
}

export function getTaskLocalId(task: TaskItem): string {
  const prefix = getTaskFilePrefix(task.sourceFile)
  const expected = prefix ? `${prefix}${TASK_ID_SEPARATOR}` : ''
  if (expected && task.id.startsWith(expected)) {
    return task.id.slice(expected.length)
  }
  return task.id
}

export type TaskIndex = {
  byId: Map<string, TaskItem[]>
}

export function buildTaskIndex(tasks: TaskItem[]): TaskIndex {
  const byId = new Map<string, TaskItem[]>()
  tasks.forEach(task => {
    const list = byId.get(task.id) || []
    list.push(task)
    byId.set(task.id, list)
  })
  return { byId }
}

export function resolveTaskReference(ref: string, task: TaskItem, index: TaskIndex): string | null {
  const normalizedRef = normalizeTaskId(ref)
  if (!normalizedRef) return null
  if (index.byId.has(normalizedRef)) return normalizedRef

  const prefix = getTaskFilePrefix(task.sourceFile)
  if (prefix) {
    const candidate = `${prefix}${TASK_ID_SEPARATOR}${normalizedRef}`
    if (index.byId.has(candidate)) return candidate
  }
  return null
}

export function resolveTaskRefList(refs: string[], task: TaskItem, index: TaskIndex): string[] {
  const resolved: string[] = []
  refs.forEach(ref => {
    const next = resolveTaskReference(ref, task, index)
    if (next) resolved.push(next)
  })
  return Array.from(new Set(resolved))
}

export function resolveTaskDependencies(tasks: TaskItem[]): Map<string, string[]> {
  const index = buildTaskIndex(tasks)
  const resolved = new Map<string, string[]>()

  tasks.forEach(task => {
    const deps = resolveTaskRefList(task.blockedBy ?? [], task, index)
    resolved.set(task.id, deps)
  })

  return resolved
}
