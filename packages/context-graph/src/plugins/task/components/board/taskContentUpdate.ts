import { TaskItem } from '../../types'

function findTaskBlockStart(lines: string[], sourceLine?: number): number {
  if (!sourceLine) return -1
  const startIndex = Math.max(sourceLine - 1, 0)
  for (let i = startIndex; i >= 0; i--) {
    if (lines[i].trim() === '```task') return i
  }
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].trim() === '```task') return i
  }
  return -1
}

function findTaskBlockEnd(lines: string[], startIndex: number): number {
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```') return i
  }
  return -1
}

function updateTaskBlockLines(
  lines: string[],
  updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }
): string[] {
  const next = [...lines]

  const findFieldIndex = (key: string) =>
    next.findIndex((line) => line.trimStart() === line && line.startsWith(`${key}:`))

  const upsertField = (key: string, value: string | undefined) => {
    if (!value) return
    const index = findFieldIndex(key)
    if (index >= 0) {
      next[index] = `${key}: ${value}`
      return
    }
    const titleIndex = findFieldIndex('title')
    const insertAt = titleIndex >= 0 ? titleIndex + 1 : 0
    next.splice(insertAt, 0, `${key}: ${value}`)
  }

  upsertField('status', updates.status)
  upsertField('priority', updates.priority)

  return next
}

export function updateTaskContent(
  content: string,
  task: TaskItem,
  updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }
): string | null {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const startIndex = findTaskBlockStart(lines, task.sourceLine)
  if (startIndex === -1) return null
  const endIndex = findTaskBlockEnd(lines, startIndex)
  if (endIndex === -1) return null

  const bodyLines = lines.slice(startIndex + 1, endIndex)
  const updatedBody = updateTaskBlockLines(bodyLines, updates)
  if (updatedBody.join('\n') === bodyLines.join('\n')) {
    return null
  }

  const nextLines = [
    ...lines.slice(0, startIndex + 1),
    ...updatedBody,
    ...lines.slice(endIndex),
  ]

  return nextLines.join('\n')
}

