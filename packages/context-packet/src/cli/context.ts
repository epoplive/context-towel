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
  /** When set, injects more detail for this active work node */
  activeNode?: string
  /** When true, include diagram content for active nodes */
  includeDiagrams?: boolean
}

export async function buildContextOutput(contextDir: string, name: string, reader: FileReader = defaultReader, options?: ContextOutputOptions, gitChanges?: GitChanges | null): Promise<string | null> {
  // Try directory format first: {name}/packet.md, then legacy: {name}.md
  let content: string
  let packetPath: string
  try {
    packetPath = `${contextDir}/packets/active/${name}/packet.md`
    content = await reader(packetPath)
  } catch {
    try {
      packetPath = `${contextDir}/packets/active/${name}.md`
      content = await reader(packetPath)
    } catch {
      return null
    }
  }

  const focusNodes = options?.focusNodes
  const activeNode = options?.activeNode
  const vectors = extractVectorsCompact(content)
  const nodes = focusNodes
    ? extractFocusedNodesCompact(content, new Set(focusNodes))
    : activeNode
      ? extractActiveNodeAware(content, activeNode)
      : extractNodesCompact(content)
  const recent = extractRecentDeltas(content, 3)
  const whiteboard = extractWhiteboardCompact(content)

  const lines: string[] = [
    `<context-packet name="${name}" file="${packetPath}">`,
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

  // Linked doc content for active/focused nodes
  if (activeNode || focusNodes) {
    const docLinks = extractDocLinks(content, activeNode ? new Set([activeNode]) : new Set(focusNodes))
    if (docLinks.length > 0) {
      const packetDir = packetPath.substring(0, packetPath.lastIndexOf('/'))
      for (const { nodeId, docPath } of docLinks) {
        try {
          const docContent = await reader(`${packetDir}/${docPath}`)
          lines.push(`<doc node="${nodeId}" path="${docPath}">`)
          // Truncate very large docs to keep injection reasonable
          const truncated = docContent.length > 2000
            ? docContent.slice(0, 2000) + '\n... (truncated, read full doc for more)'
            : docContent
          lines.push(truncated)
          lines.push('</doc>')
        } catch {
          // Doc doesn't exist or can't be read — skip
        }
      }
    }
  }

  // Edge graph — shows how nodes connect
  const edgeGraph = extractEdgeGraph(content)
  if (edgeGraph.length > 0) {
    lines.push('<edges>')
    for (const e of edgeGraph) {
      lines.push(`  ${e}`)
    }
    lines.push('</edges>')
  }

  // Reference pointers — what files each work node should read
  const refs = extractReferencePointers(content)
  if (refs.length > 0) {
    lines.push('<references>')
    for (const r of refs) {
      lines.push(`  ${r}`)
    }
    lines.push('</references>')
  }

  // Test status — what tests verify each work node
  const tests = extractTestStatus(content)
  if (tests.length > 0) {
    lines.push('<test-status>')
    for (const t of tests) {
      lines.push(`  ${t}`)
    }
    lines.push('</test-status>')
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
  lines.push('  RESUMING FROM CONTEXT CLEAR:')
  lines.push('  If this is a new conversation, the packet above IS your complete context.')
  lines.push('  - Vectors show the problem state and what you are solving')
  lines.push('  - Nodes show what work is active, what succeeded, what failed')
  lines.push('  - Edges show how nodes connect (references, tests, diagrams)')
  lines.push('  - References tell you what files to read for context')
  lines.push('  - Test status tells you what is verified and what needs running')
  lines.push('  - Recent deltas show what happened most recently')
  lines.push('  - File changes show what code was modified')
  lines.push('  Continue from the active nodes. Do NOT re-explore already-resolved work.')
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

/** Parsed node metadata for rich injection */
interface ParsedNode {
  id: string
  state: string
  type?: string
  path?: string
  doc?: string
  edges?: string[]
  summary: string
  /** Full body text (for active-node-aware injection) */
  fullBody?: string
}

/**
 * Parse all ~~~node blocks from the AICCL section into structured data.
 */
function parseNodeBlocks(content: string): ParsedNode[] {
  const sectionMatch = content.match(
    /## AICCL\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const nodes: ParsedNode[] = []

  const nodePattern = /~~~node\s*\n([\s\S]*?)~~~/g
  let match: RegExpExecArray | null
  while ((match = nodePattern.exec(section)) !== null) {
    const block = match[1]
    const id = block.match(/^id:\s*(.+)/m)?.[1]?.trim() ?? ''
    const state = block.match(/^state:\s*(.+)/m)?.[1]?.trim() ?? ''
    if (!id) continue

    const type = block.match(/^type:\s*(.+)/m)?.[1]?.trim()
    const path = block.match(/^path:\s*(.+)/m)?.[1]?.trim()
    const doc = block.match(/^doc:\s*(.+)/m)?.[1]?.trim()
    const edgesRaw = block.match(/^edges:\s*(.+)/m)?.[1]?.trim()
    const edges = edgesRaw ? edgesRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined

    let summary = ''
    let fullBody = ''
    const separatorIdx = block.indexOf('\n---')
    if (separatorIdx !== -1) {
      fullBody = block.slice(separatorIdx + 4).trim()
      const bodyLines = fullBody.split('\n').filter(l => l.trim())
      if (bodyLines.length > 0) {
        summary = bodyLines[0].trim()
        if (summary.length > 80) summary = summary.slice(0, 77) + '...'
      }
    }

    nodes.push({ id, state, type, path, doc, edges, summary, fullBody })
  }

  return nodes
}

/**
 * Extract compact node lines from AICCL section.
 * Active nodes include type, path, and edge info.
 * Resolved nodes are condensed into a single "resolved:" line.
 */
function extractNodesCompact(content: string): string[] {
  const nodes = parseNodeBlocks(content)
  const activeLines: string[] = []
  const resolvedIds: string[] = []

  for (const node of nodes) {
    if (RESOLVED_STATES.has(node.state)) {
      resolvedIds.push(node.id)
      continue
    }

    activeLines.push(
      node.summary ? `${node.id} [${node.state}]: ${node.summary}` : `${node.id} [${node.state}]`,
    )
  }

  if (resolvedIds.length > 0) {
    activeLines.push(`resolved: ${resolvedIds.join(', ')}`)
  }

  return activeLines
}

/**
 * Active-node-aware extraction: full detail for the active node and its
 * edge-connected neighbors, compressed summaries for everything else.
 * This is the AICCL compilation — dual rendering for LLM consumption.
 */
function extractActiveNodeAware(content: string, activeNodeId: string): string[] {
  const nodes = parseNodeBlocks(content)
  const lines: string[] = []
  const resolvedIds: string[] = []

  // Find edge-connected neighbors of the active node
  const neighborIds = new Set<string>()
  for (const node of nodes) {
    if (node.id === activeNodeId && node.edges) {
      for (const e of node.edges) neighborIds.add(e)
    }
    if (node.edges?.includes(activeNodeId)) {
      neighborIds.add(node.id)
    }
  }

  for (const node of nodes) {
    if (RESOLVED_STATES.has(node.state)) {
      resolvedIds.push(node.id)
      continue
    }

    if (node.id === activeNodeId) {
      // Active node: full body + type info
      const typeSuffix = node.type && node.type !== 'work' ? ` (${node.type}${node.path ? `: ${node.path}` : ''})` : ''
      const body = node.fullBody ? node.fullBody.split('\n').join(' ').slice(0, 300) : node.summary
      lines.push(`* ${node.id} [${node.state}]${typeSuffix}: ${body}`)
    } else if (neighborIds.has(node.id)) {
      // Neighbor: type + path + summary (medium detail)
      const typeSuffix = node.type && node.type !== 'work' ? ` (${node.type}${node.path ? `: ${node.path}` : ''})` : ''
      lines.push(`  ${node.id} [${node.state}]${typeSuffix}: ${node.summary}`)
    } else {
      // Everything else: id + state only (minimal)
      lines.push(`  ${node.id} [${node.state}]`)
    }
  }

  if (resolvedIds.length > 0) {
    lines.push(`resolved: ${resolvedIds.join(', ')}`)
  }

  return lines
}

/**
 * Compile packet content to compressed AICCL for LLM injection.
 * Produces a maximally token-efficient representation.
 *
 * This is the public compilation API — used by the CLI `compile` command.
 */
export async function compileToAiccl(
  contextDir: string,
  name: string,
  reader: FileReader = defaultReader,
  activeNode?: string,
): Promise<{ aiccl: string; tokenEstimate: number } | null> {
  // Try directory format first, then legacy
  let content: string
  try {
    content = await reader(`${contextDir}/packets/active/${name}/packet.md`)
  } catch {
    try {
      content = await reader(`${contextDir}/packets/active/${name}.md`)
    } catch {
      return null
    }
  }

  const output = await buildContextOutput(contextDir, name, reader, {
    activeNode,
    includeDiagrams: true,
  })
  if (!output) return null

  // Rough token estimate: ~4 chars per token for English text
  const tokenEstimate = Math.ceil(output.length / 4)
  const humanTokens = Math.ceil(content.length / 4)

  const lines = [
    output,
    '',
    `<!-- AICCL compilation: ${tokenEstimate} tokens (${Math.round((1 - tokenEstimate / humanTokens) * 100)}% reduction from ${humanTokens} human tokens) -->`,
  ]

  return { aiccl: lines.join('\n'), tokenEstimate }
}

/**
 * Extract edge graph as compact adjacency list.
 * Format: `nodeA → nodeB, nodeC`
 */
function extractEdgeGraph(content: string): string[] {
  const nodes = parseNodeBlocks(content)
  const adjacency = new Map<string, Set<string>>()

  for (const node of nodes) {
    if (!node.edges || node.edges.length === 0) continue
    for (const target of node.edges) {
      // Edges are bidirectional — add from source's perspective
      if (!adjacency.has(node.id)) adjacency.set(node.id, new Set())
      adjacency.get(node.id)!.add(target)
    }
  }

  const lines: string[] = []
  for (const [source, targets] of adjacency) {
    lines.push(`${source} → ${[...targets].join(', ')}`)
  }
  return lines
}

/**
 * Extract doc links from node blocks for a set of target node IDs.
 * Reads the doc: field from parsed node headers.
 */
function extractDocLinks(content: string, targetNodeIds: Set<string>): Array<{ nodeId: string; docPath: string }> {
  const results: Array<{ nodeId: string; docPath: string }> = []
  const nodes = parseNodeBlocks(content)

  for (const node of nodes) {
    if (!targetNodeIds.has(node.id)) continue
    if (node.doc) {
      results.push({ nodeId: node.id, docPath: node.doc })
    }
  }

  return results
}

/**
 * Extract reference pointers grouped by connected work node.
 * Format: `work-node: /path/to/file.md, /other/path.ts`
 */
function extractReferencePointers(content: string): string[] {
  const nodes = parseNodeBlocks(content)
  const refsByWork = new Map<string, string[]>()

  for (const node of nodes) {
    if (node.type !== 'reference' || !node.path) continue
    if (!node.edges) continue
    for (const workId of node.edges) {
      if (!refsByWork.has(workId)) refsByWork.set(workId, [])
      refsByWork.get(workId)!.push(node.path)
    }
  }

  const lines: string[] = []
  for (const [workId, paths] of refsByWork) {
    lines.push(`${workId}: ${paths.join(', ')}`)
  }
  return lines
}

/**
 * Extract test status per work node.
 * Format: `work-node: test.spec.ts [pass], other.spec.ts [pending]`
 */
function extractTestStatus(content: string): string[] {
  const nodes = parseNodeBlocks(content)
  const testsByWork = new Map<string, string[]>()

  for (const node of nodes) {
    if (node.type !== 'test') continue
    if (!node.edges) continue

    let status = 'pending'
    if (node.state === 'success' || node.state === 'resolved' || node.state === 'promoted') status = 'pass'
    else if (node.state === 'failed') status = 'fail'

    const label = node.path ?? node.id
    const shortLabel = label.split('/').pop() ?? label

    for (const workId of node.edges) {
      if (!testsByWork.has(workId)) testsByWork.set(workId, [])
      testsByWork.get(workId)!.push(`${shortLabel} [${status}]`)
    }
  }

  const lines: string[] = []
  for (const [workId, tests] of testsByWork) {
    lines.push(`${workId}: ${tests.join(', ')}`)
  }
  return lines
}

/**
 * Extract nodes matching a focused set of node IDs — for subagent sliced injection.
 * Includes full body for focused nodes + edge-connected nodes at summary level.
 */
function extractFocusedNodesCompact(content: string, focusIds: Set<string>): string[] {
  const nodes = parseNodeBlocks(content)
  const focusedLines: string[] = []
  const contextLines: string[] = []

  // Build reverse edge map: nodeId → set of connected nodeIds
  const edgeConnections = new Map<string, Set<string>>()
  for (const node of nodes) {
    if (!node.edges) continue
    for (const target of node.edges) {
      if (!edgeConnections.has(node.id)) edgeConnections.set(node.id, new Set())
      edgeConnections.get(node.id)!.add(target)
      if (!edgeConnections.has(target)) edgeConnections.set(target, new Set())
      edgeConnections.get(target)!.add(node.id)
    }
  }

  for (const node of nodes) {
    if (focusIds.has(node.id)) {
      // Full detail for focused nodes
      const typeSuffix = node.type && node.type !== 'work' ? ` (${node.type}${node.path ? `: ${node.path}` : ''})` : ''
      focusedLines.push(`${node.id} [${node.state}]${typeSuffix}: ${node.summary}`)
    } else {
      // Include edge-connected nodes at summary level
      const connected = edgeConnections.get(node.id)
      if (connected && [...connected].some(c => focusIds.has(c))) {
        const typeSuffix = node.type && node.type !== 'work' ? ` (${node.type})` : ''
        contextLines.push(`${node.id} [${node.state}]${typeSuffix}: (connected)`)
      }
    }
  }

  return [...focusedLines, ...contextLines]
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
