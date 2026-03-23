// ============================================================================
// packet context — Fast filesystem-only context extraction (no DB)
//
// Captures git changes between turns and injects packet context + evidence.
// ============================================================================

import { readFile } from 'node:fs/promises'
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

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
export interface ContextOutputOptions {
  /** When set, produces a focused slice for subagent consumption */
  focusNodes?: string[]
}

export async function buildContextOutput(contextDir: string, name: string, reader: FileReader = defaultReader, options?: ContextOutputOptions, gitChanges?: GitChanges | null): Promise<string | null> {
  const packetPath = `${contextDir}/packets/active/${name}.md`
  let content: string
  try {
    content = await reader(packetPath)
  } catch {
    return null
  }

  const focusNodes = options?.focusNodes
  const vectors = extractVectorsCompact(content)
  const nodes = focusNodes
    ? extractFocusedNodesCompact(content, new Set(focusNodes))
    : extractNodesCompact(content)
  const recent = extractRecentDeltas(content, 3)
  const whiteboard = extractWhiteboardCompact(content)

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

  if (whiteboard.length > 0) {
    lines.push('<whiteboard>')
    for (const w of whiteboard) {
      lines.push(`  ${w}`)
    }
    lines.push('</whiteboard>')
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

  // ── Git changes since last turn ──
  if (gitChanges && gitChanges.files.length > 0) {
    lines.push(`<file-changes ref="${gitChanges.headRef}" count="${gitChanges.files.length}">`)
    // Show up to 20 files to keep token budget reasonable
    const filesToShow = gitChanges.files.slice(0, 20)
    for (const f of filesToShow) {
      lines.push(`  ${f}`)
    }
    if (gitChanges.files.length > 20) {
      lines.push(`  ... and ${gitChanges.files.length - 20} more`)
    }
    // Include stat summary (last line has total)
    if (gitChanges.stat) {
      const statLines = gitChanges.stat.split('\n')
      const summary = statLines[statLines.length - 1]
      if (summary) lines.push(`  ${summary.trim()}`)
    }
    lines.push('</file-changes>')
  }

  lines.push('<instructions>')
  lines.push('  The packet is your working memory. It captures what you know, what you tried,')
  lines.push('  what failed, and what the current state of the problem is.')
  lines.push('')
  lines.push('  AFTER COMPLETING YOUR WORK THIS TURN:')
  lines.push('  1. Update the packet to reflect what you learned and changed:')
  lines.push('     - Add discoveries: .claude/bin/packet delta append <nodeId> --type discovery --content "<what you found>"')
  lines.push('     - Record failures: .claude/bin/packet node fail <id> --tried "<approach>" --reason "<why>"')
  lines.push('     - Promote successes: .claude/bin/packet node promote <id>')
  lines.push('     - Update whiteboard: .claude/bin/packet whiteboard update --section "<name>" --content "<mermaid>"')
  lines.push('     - Update vectors: .claude/bin/packet vector update <id> --current "<state>" --approach "<plan>"')
  lines.push('     - Add criteria: .claude/bin/packet vector criterion add <vecId> --text "<text>" [--type solved|fact]')
  lines.push('  2. Keep the whiteboard diagrams current — they are the human-facing view of the problem.')
  lines.push('  3. Record file changes as evidence when you modify code.')
  lines.push('')
  lines.push('  The packet is NOT a task tracker. It captures knowledge, research, evidence,')
  lines.push('  reasoning, and discoveries. Update it with what you LEARNED, not just what you DID.')
  lines.push('</instructions>')
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

    // Include structured criteria/facts summary if present
    const criteriaSection = body.match(/#### Solved Criteria\s*\n([\s\S]*?)(?=\n####|$)/)
    if (criteriaSection) {
      const proven = (criteriaSection[1].match(/- \[x\]/gi) ?? []).length
      const pending = (criteriaSection[1].match(/- \[ \]/g) ?? []).length
      const failed = (criteriaSection[1].match(/- \[!\]/g) ?? []).length
      if (proven + pending + failed > 0) {
        results.push(`  criteria: ${proven} proven, ${pending} pending, ${failed} failed`)
      }
    }

    const factsSection = body.match(/#### Problem Facts\s*\n([\s\S]*?)(?=\n####|$)/)
    if (factsSection) {
      const established = (factsSection[1].match(/- \[established\]/gi) ?? []).length
      const gaps = (factsSection[1].match(/- \[gap\]/gi) ?? []).length
      if (established + gaps > 0) {
        results.push(`  facts: ${established} established, ${gaps} gaps`)
      }
    }
  }

  return results
}

/** Terminal states — nodes in these states are done and don't need full injection */
const RESOLVED_STATES = new Set(['success', 'failed', 'done'])

/**
 * Extract compact node lines from AICCL section.
 * Only includes active/in-progress nodes with full summaries.
 * Resolved nodes are condensed into a single "resolved:" line.
 * Format: `id [state]: first line of body`
 */
function extractNodesCompact(content: string): string[] {
  const sectionMatch = content.match(
    /## AICCL\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const activeNodes: string[] = []
  const resolvedIds: string[] = []

  // Match ~~~node blocks (body is after --- separator)
  const nodePattern = /~~~node\s*\n([\s\S]*?)~~~/g
  let match: RegExpExecArray | null
  while ((match = nodePattern.exec(section)) !== null) {
    const block = match[1]
    const id = block.match(/^id:\s*(.+)/m)?.[1]?.trim() ?? ''
    const state = block.match(/^state:\s*(.+)/m)?.[1]?.trim() ?? ''
    if (!id) continue

    // Resolved nodes get condensed to just their id
    if (RESOLVED_STATES.has(state)) {
      resolvedIds.push(id)
      continue
    }

    // Active nodes get full summary
    let summary = ''
    const separatorIdx = block.indexOf('\n---')
    if (separatorIdx !== -1) {
      const bodyText = block.slice(separatorIdx + 4).trim()
      const bodyLines = bodyText.split('\n').filter(l => l.trim())
      if (bodyLines.length > 0) {
        summary = bodyLines[0].trim()
        if (summary.length > 80) summary = summary.slice(0, 77) + '...'
      }
    }

    activeNodes.push(summary ? `${id} [${state}]: ${summary}` : `${id} [${state}]`)
  }

  // Append condensed resolved list
  if (resolvedIds.length > 0) {
    activeNodes.push(`resolved: ${resolvedIds.join(', ')}`)
  }

  return activeNodes
}

/**
 * Extract nodes matching a focused set of node IDs — for subagent sliced injection.
 * Includes full body for focused nodes + their derives-from chain (summary level).
 */
function extractFocusedNodesCompact(content: string, focusIds: Set<string>): string[] {
  const sectionMatch = content.match(
    /## AICCL\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const focusedNodes: string[] = []
  const contextNodes: string[] = []

  const nodePattern = /~~~node\s*\n([\s\S]*?)~~~/g
  let match: RegExpExecArray | null
  while ((match = nodePattern.exec(section)) !== null) {
    const block = match[1]
    const id = block.match(/^id:\s*(.+)/m)?.[1]?.trim() ?? ''
    const state = block.match(/^state:\s*(.+)/m)?.[1]?.trim() ?? ''
    if (!id) continue

    if (focusIds.has(id)) {
      // Full body for focused nodes
      const separatorIdx = block.indexOf('\n---')
      const bodyText = separatorIdx !== -1 ? block.slice(separatorIdx + 4).trim() : ''
      focusedNodes.push(`${id} [${state}]: ${bodyText.split('\n').join(' ').slice(0, 200)}`)
    } else {
      // Check if this node is in the derives-from chain of a focused node
      const dfMatch = block.match(/^derives-from:\s*(.+)/m)
      if (dfMatch) {
        const deps = dfMatch[1].split(',').map(s => s.trim())
        if (deps.some(d => focusIds.has(d))) {
          contextNodes.push(`${id} [${state}]: (context)`)
        }
      }
    }
  }

  return [...focusedNodes, ...contextNodes]
}

/**
 * Extract whiteboard section summaries (diagram names and types).
 * These are the human-facing visual elements of the packet.
 */
function extractWhiteboardCompact(content: string): string[] {
  const sectionMatch = content.match(
    /## Whiteboard\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const results: string[] = []

  // Find subsection headers (### name)
  const headerPattern = /### (\S+)/g
  let match: RegExpExecArray | null
  while ((match = headerPattern.exec(section)) !== null) {
    results.push(match[1])
  }

  // Count mermaid diagrams
  const diagramCount = (section.match(/```mermaid/g) ?? []).length
  if (diagramCount > 0) {
    results.push(`(${diagramCount} diagram${diagramCount > 1 ? 's' : ''})`)
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

// ── Git change capture ──────────────────────────────────────────

/** State file tracking the last seen git ref for diff detection */
const LAST_REF_FILE = '.context/.packet-last-ref'

interface GitChanges {
  /** Files modified/added/deleted since last turn */
  files: string[]
  /** Compact stat summary (insertions/deletions per file) */
  stat: string
  /** Current short ref (HEAD) */
  headRef: string
}

/**
 * Capture git changes since the last recorded ref.
 * Writes the current HEAD ref to the state file for next comparison.
 */
function captureGitChanges(projectDir: string): GitChanges | null {
  try {
    const headRef = execSync('git rev-parse --short HEAD', { cwd: projectDir, encoding: 'utf-8' }).trim()

    let lastRef: string | null = null
    try {
      lastRef = readFileSync(`${projectDir}/${LAST_REF_FILE}`, 'utf-8').trim()
    } catch { /* no previous ref */ }

    let files: string[] = []
    let stat = ''

    if (lastRef && lastRef !== headRef) {
      // Changes between last seen ref and current HEAD
      try {
        const nameOnly = execSync(`git diff --name-only ${lastRef}..HEAD`, { cwd: projectDir, encoding: 'utf-8' }).trim()
        files = nameOnly ? nameOnly.split('\n').filter(Boolean) : []
        stat = execSync(`git diff --stat ${lastRef}..HEAD`, { cwd: projectDir, encoding: 'utf-8' }).trim()
      } catch { /* diff failed, maybe ref was rebased away */ }
    }

    // Also capture uncommitted changes (staged + unstaged)
    try {
      const uncommitted = execSync('git diff --name-only HEAD', { cwd: projectDir, encoding: 'utf-8' }).trim()
      const staged = execSync('git diff --name-only --cached', { cwd: projectDir, encoding: 'utf-8' }).trim()
      const uncommittedFiles = [...new Set([
        ...(uncommitted ? uncommitted.split('\n') : []),
        ...(staged ? staged.split('\n') : []),
      ])].filter(Boolean)

      if (uncommittedFiles.length > 0) {
        // Merge with committed changes, dedup
        const allFiles = new Set([...files, ...uncommittedFiles])
        files = [...allFiles]

        if (!stat) {
          stat = execSync('git diff --stat HEAD', { cwd: projectDir, encoding: 'utf-8' }).trim()
        }
      }
    } catch { /* no uncommitted changes */ }

    // Update the state file with current ref
    try {
      writeFileSync(`${projectDir}/${LAST_REF_FILE}`, headRef, 'utf-8')
    } catch { /* best effort */ }

    if (files.length === 0) return null

    return { files, stat, headRef }
  } catch {
    return null // Not a git repo or git not available
  }
}

/**
 * Run the fast-path context command.
 * Captures git changes and injects packet context.
 */
export async function runContextCommand(contextDir: string): Promise<void> {
  const name = await readActiveMarker(contextDir)
  if (!name) return // Silent exit when no active packet

  // Derive project root from contextDir (.context is inside project root)
  const projectDir = contextDir.replace(/\/.context$/, '')
  const gitChanges = captureGitChanges(projectDir)

  const output = await buildContextOutput(contextDir, name, defaultReader, undefined, gitChanges)
  if (output) {
    console.log(output)
  }
}
