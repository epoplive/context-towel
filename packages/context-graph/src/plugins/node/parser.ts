// ============================================================================
// Node Plugin Parser
// ============================================================================
//
// Parses ~~~node blocks with YAML header + --- separator + opaque body:
//
// ~~~node
// id: packet-engine
// state: active
// layer: region
// subsystem: core
// ---
// Manages packet lifecycle and node state transitions.
// ~~~

import { ParseResult, SourceMatch } from '../../types'
import { NodeItem, NodeState } from './types'

const NODE_FENCE_RE = /(?:^|\n)([ \t]*(?:`{3,}|~{3,})\s*node\b[^\n]*)\n([\s\S]*?)\n([ \t]*(?:`{3,}|~{3,}))\s*(?:\n|$)/gm

/**
 * Detect if content contains ~~~node blocks
 */
export function detectNodes(content: string): boolean {
  return /(?:`{3,}|~{3,})\s*node\b/im.test(content)
}

/**
 * Parse a YAML-like header above --- separator.
 * Returns key-value pairs from lines like `key: value`.
 */
function parseYamlHeader(header: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of header.split('\n')) {
    const match = line.match(/^\s*(\w[\w-]*)\s*:\s*(.+)/)
    if (match) {
      fields[match[1].trim()] = match[2].trim()
    }
  }
  return fields
}

/**
 * Parse ~~~node blocks from markdown content.
 */
export function parseNodes(content: string, sourceFile: string): ParseResult<NodeItem> {
  const items: NodeItem[] = []
  const rawMatches: SourceMatch[] = []

  let nodeIndex = 0
  let match: RegExpExecArray | null

  // Reset lastIndex for global regex
  NODE_FENCE_RE.lastIndex = 0

  while ((match = NODE_FENCE_RE.exec(content)) !== null) {
    const fullMatch = match[0]
    const innerContent = match[2]

    // Find start position in content
    const matchStart = match.index + (fullMatch.startsWith('\n') ? 1 : 0)

    // Count lines to get startLine
    const beforeMatch = content.slice(0, matchStart)
    const startLine = beforeMatch.split('\n').length
    const endLine = startLine + fullMatch.trimStart().split('\n').length - 1

    // Split on --- separator to get header and body
    const separatorIdx = innerContent.indexOf('\n---')
    let header: string
    let body: string

    if (separatorIdx !== -1) {
      header = innerContent.slice(0, separatorIdx)
      body = innerContent.slice(separatorIdx + 4).trim() // skip \n---
    } else {
      // No separator: treat entire content as header with empty body
      header = innerContent
      body = ''
    }

    const fields = parseYamlHeader(header)

    const nodeId = fields.id ?? `node-${nodeIndex}`
    const state = (fields.state ?? 'active') as NodeState
    const layer = fields.layer
    const subsystem = fields.subsystem

    items.push({
      id: `node-${nodeIndex}`,
      sourceFile,
      sourceLine: startLine,
      sourceEndLine: endLine,
      nodeId,
      state,
      layer,
      subsystem,
      body,
    })

    rawMatches.push({
      start: matchStart,
      end: matchStart + fullMatch.trimStart().length,
      startLine,
      endLine,
      content: fullMatch.trimStart(),
    })

    nodeIndex++
  }

  return {
    pluginId: 'node',
    items,
    rawMatches,
  }
}
