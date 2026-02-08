import { TaskItem } from '../../types'

type FenceInfo = {
  index: number
  marker: '`' | '~'
  length: number
}

function parseTaskFenceStart(line: string): { marker: '`' | '~'; length: number } | null {
  const match = line.match(/^\s{0,3}((?:`{3,})|(?:~{3,}))\s*task(?:\s|$)/i)
  if (!match) return null
  const fence = match[1] ?? ''
  const marker = fence[0] === '~' ? '~' : '`'
  return { marker, length: fence.length }
}

function buildFenceCloseRegex(marker: '`' | '~', length: number): RegExp {
  // Closing fences can be indented up to 3 spaces.
  if (marker === '`') return new RegExp('^\\s{0,3}`{' + length + ',}\\s*$')
  return new RegExp('^\\s{0,3}~{' + length + ',}\\s*$')
}

function findTaskBlockStart(lines: string[], sourceLine?: number): FenceInfo | null {
  if (!sourceLine) return null
  const startIndex = Math.max(sourceLine - 1, 0)
  for (let i = startIndex; i >= 0; i--) {
    const info = parseTaskFenceStart(lines[i] ?? '')
    if (info) return { index: i, ...info }
  }
  for (let i = startIndex; i < lines.length; i++) {
    const info = parseTaskFenceStart(lines[i] ?? '')
    if (info) return { index: i, ...info }
  }
  return null
}

function findTaskBlockEnd(lines: string[], fence: FenceInfo): number {
  const closeRe = buildFenceCloseRegex(fence.marker, fence.length)
  for (let i = fence.index + 1; i < lines.length; i++) {
    if (closeRe.test(lines[i] ?? '')) return i
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
  const fence = findTaskBlockStart(lines, task.sourceLine)
  if (!fence) return null
  const endIndex = findTaskBlockEnd(lines, fence)
  if (endIndex === -1) return null

  const bodyLines = lines.slice(fence.index + 1, endIndex)
  const updatedBody = updateTaskBlockLines(bodyLines, updates)
  if (updatedBody.join('\n') === bodyLines.join('\n')) {
    return null
  }

  const nextLines = [
    ...lines.slice(0, fence.index + 1),
    ...updatedBody,
    ...lines.slice(endIndex),
  ]

  return nextLines.join('\n')
}
