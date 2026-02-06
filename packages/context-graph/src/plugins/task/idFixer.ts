import { fileService as defaultFileService } from '../../compat/services'
import { parseTasks } from './parser'
import type { TaskItem } from './types'

export type TaskIdFix = {
  filePath: string
  taskTitle: string
  id: string
  line: number | null
}

export type TaskIdFixResult = {
  updatedFiles: string[]
  fixes: TaskIdFix[]
  warnings: string[]
}

type FileSystem = Pick<typeof defaultFileService, 'listAllFiles' | 'read' | 'write'>

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])

const getExtension = (path: string): string => {
  const idx = path.lastIndexOf('.')
  return idx >= 0 ? path.slice(idx).toLowerCase() : ''
}

const insertIdLine = (blockContent: string, id: string): string => {
  const lines = blockContent.split('\n')
  const hasId = lines.some(line => /^\s*(id|task-id)\s*:/i.test(line))
  if (hasId) return blockContent
  const insertIndex = Math.min(1, lines.length)
  lines.splice(insertIndex, 0, `id: ${id}`)
  return lines.join('\n')
}

const buildIdWarnings = (tasks: Array<TaskItem & { filePath: string }>): string[] => {
  const byId = new Map<string, TaskItem[]>()
  tasks.forEach(task => {
    const list = byId.get(task.id) || []
    list.push(task)
    byId.set(task.id, list)
  })
  const warnings: string[] = []
  byId.forEach((list, id) => {
    if (list.length < 2) return
    const detail = list
      .map(task => `${task.sourceFile}${task.sourceLine ? `:${task.sourceLine}` : ''}`)
      .join(', ')
    warnings.push(`Duplicate task id "${id}" found in ${detail}`)
  })
  return warnings
}

const applyEdits = (content: string, edits: Array<{ start: number; end: number; text: string }>): string => {
  if (edits.length === 0) return content
  const sorted = [...edits].sort((a, b) => b.start - a.start)
  let next = content
  sorted.forEach(edit => {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end)
  })
  return next
}

export async function fixContextTaskIds(
  contextPath: string,
  deps: { fileService?: FileSystem } = {}
): Promise<TaskIdFixResult> {
  const fs = deps.fileService ?? defaultFileService
  const files = await fs.listAllFiles(contextPath)
  const markdownFiles = files.filter(file => MARKDOWN_EXTENSIONS.has(getExtension(file)))

  const parsedByFile = new Map<string, ReturnType<typeof parseTasks>>()
  const allTasks: Array<TaskItem & { filePath: string }> = []

  for (const filePath of markdownFiles) {
    const content = await fs.read(filePath)
    const parsed = parseTasks(content, filePath)
    parsedByFile.set(filePath, parsed)
    parsed.items.forEach(task => {
      allTasks.push({ ...task, filePath })
    })
  }

  const warnings = buildIdWarnings(allTasks)
  const fixes: TaskIdFix[] = []
  const updatedFiles: string[] = []

  for (const filePath of markdownFiles) {
    const parsed = parsedByFile.get(filePath)
    if (!parsed || parsed.items.length === 0) continue
    const content = await fs.read(filePath)

    const usedIds = new Set<string>()
    parsed.items.forEach(task => {
      if (task.explicitId) {
        usedIds.add(task.id)
      }
    })

    const edits: Array<{ start: number; end: number; text: string }> = []

    parsed.items.forEach((task, index) => {
      if (task.explicitId) return
      const match = parsed.rawMatches?.[index]
      if (!match) return

      const baseId = task.id
      let candidate = baseId
      let counter = 2
      while (usedIds.has(candidate)) {
        candidate = `${baseId}-${counter}`
        counter += 1
      }
      usedIds.add(candidate)

      const updatedBlock = insertIdLine(match.content, candidate)
      edits.push({ start: match.start, end: match.end, text: updatedBlock })
      fixes.push({
        filePath,
        taskTitle: task.title,
        id: candidate,
        line: match.startLine ?? null,
      })
    })

    if (edits.length > 0) {
      const nextContent = applyEdits(content, edits)
      if (nextContent !== content) {
        await fs.write(filePath, nextContent)
        updatedFiles.push(filePath)
      }
    }
  }

  return {
    updatedFiles,
    fixes,
    warnings,
  }
}
