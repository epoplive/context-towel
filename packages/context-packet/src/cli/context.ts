// ============================================================================
// packet context — Fast filesystem-only context extraction (no DB)
// ============================================================================

import { readFile } from 'node:fs/promises'

/** File reader function type — defaults to fs.readFile but injectable for tests */
export type FileReader = (path: string) => Promise<string>

const defaultReader: FileReader = (path) => readFile(path, 'utf-8')

/**
 * Read the active packet name from the .context/active marker file.
 * Returns null if no marker exists.
 */
export async function readActiveMarker(contextDir: string, reader: FileReader = defaultReader): Promise<string | null> {
  try {
    const content = await reader(`${contextDir}/active`)
    return content.trim() || null
  } catch {
    return null
  }
}

/**
 * Read and parse the materialized packet markdown from disk.
 * Returns compact XML context block for hook injection.
 * Returns null if the packet file doesn't exist.
 */
export async function buildContextOutput(contextDir: string, name: string, reader: FileReader = defaultReader): Promise<string | null> {
  const packetPath = `${contextDir}/packets/active/${name}.md`
  let content: string
  try {
    content = await reader(packetPath)
  } catch {
    return null
  }

  const vectors = extractVectorsCompact(content)
  const nodes = extractNodesCompact(content)
  const recent = extractRecentDeltas(content, 3)

  const lines: string[] = [
    `<context-packet name="${name}" file=".context/packets/active/${name}.md">`,
  ]

  if (vectors.length > 0) {
    lines.push('<vectors>')
    for (const v of vectors) {
      lines.push(`  ${v}`)
    }
    lines.push('</vectors>')
  }

  if (nodes.length > 0) {
    lines.push('<nodes>')
    for (const n of nodes) {
      lines.push(`  ${n}`)
    }
    lines.push('</nodes>')
  }

  if (recent.length > 0) {
    lines.push(`<recent count="${recent.length}">`)
    for (const r of recent) {
      lines.push(`  ${r}`)
    }
    lines.push('</recent>')
  }

  lines.push('</context-packet>')
  return lines.join('\n')
}

/**
 * Extract compact vector lines from Problem Vectors section.
 * Format: `id [state]: current → target (approach)`
 */
function extractVectorsCompact(content: string): string[] {
  const sectionMatch = content.match(
    /## Problem Vectors\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const results: string[] = []

  const vectorPattern = /### (\S+) \[(\w+)\]\s*\n([\s\S]*?)(?=\n### |\n## |\n# |$)/g
  let match: RegExpExecArray | null
  while ((match = vectorPattern.exec(section)) !== null) {
    const id = match[1]
    const state = match[2]
    const body = match[3]

    const current = body.match(/- \*\*Current:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
    const target = body.match(/- \*\*Target:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
    const approach = body.match(/- \*\*Approach:\*\*\s*(.+)/)?.[1]?.trim() ?? ''

    // Skip placeholder entries
    if ((!current || current.startsWith('<!--')) &&
        (!target || target.startsWith('<!--')) &&
        (!approach || approach.startsWith('<!--'))) {
      continue
    }

    results.push(`${id} [${state}]: ${current} → ${target} (${approach})`)
  }

  return results
}

/**
 * Extract compact node lines from AICCL section.
 * Format: `id [state]` or `id [state]: first line of body`
 */
function extractNodesCompact(content: string): string[] {
  const sectionMatch = content.match(
    /## AICCL\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const results: string[] = []

  // Match ~~~node blocks
  const nodePattern = /~~~node\s*\n([\s\S]*?)~~~/g
  let match: RegExpExecArray | null
  while ((match = nodePattern.exec(section)) !== null) {
    const block = match[1]
    const id = block.match(/^id:\s*(.+)/m)?.[1]?.trim() ?? ''
    const state = block.match(/^state:\s*(.+)/m)?.[1]?.trim() ?? ''
    if (!id) continue

    // Get first non-empty line of body
    const bodyMatch = block.match(/^body:\s*\|\s*\n([\s\S]*)/m)
    let summary = ''
    if (bodyMatch) {
      const bodyLines = bodyMatch[1].split('\n')
        .map(l => l.replace(/^ {2}/, ''))
        .filter(l => l.trim())
      if (bodyLines.length > 0) {
        summary = bodyLines[0].trim()
        if (summary.length > 80) summary = summary.slice(0, 77) + '...'
      }
    }

    results.push(summary ? `${id} [${state}]: ${summary}` : `${id} [${state}]`)
  }

  return results
}

/**
 * Extract N most recent delta lines.
 * Format: `[type] nodeId: content`
 */
function extractRecentDeltas(content: string, count: number): string[] {
  const sectionMatch = content.match(
    /## Delta Log\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const results: string[] = []

  // Deltas are already most-recent-first in the materialized markdown
  // Format: - `timestamp` **type**[ [nodeId]]: content
  const deltaPattern = /^- `[^`]+` \*\*(\w+)\*\*(?:\s*\[([^\]]+)\])?: (.+)/gm
  let match: RegExpExecArray | null
  while ((match = deltaPattern.exec(section)) !== null && results.length < count) {
    const type = match[1]
    const nodeId = match[2] ?? ''
    let deltaContent = match[3].trim()
    if (deltaContent.length > 100) deltaContent = deltaContent.slice(0, 97) + '...'
    results.push(nodeId ? `[${type}] ${nodeId}: ${deltaContent}` : `[${type}]: ${deltaContent}`)
  }

  return results
}

/**
 * Run the fast-path context command.
 * Reads filesystem only — no DB initialization needed.
 */
export async function runContextCommand(contextDir: string): Promise<void> {
  const name = await readActiveMarker(contextDir)
  if (!name) return // Silent exit when no active packet

  const output = await buildContextOutput(contextDir, name)
  if (output) {
    console.log(output)
  }
}
