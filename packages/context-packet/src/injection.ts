// ============================================================================
// Problem Vector Injection — Extract and inject into CLAUDE.md
// ============================================================================

import type { NodeState } from './types.js'
import type { ProblemVectorState } from './template.js'

export const PACKET_SECTION_START = '<!-- CONTEXT_PACKET_START -->'
export const PACKET_SECTION_END = '<!-- CONTEXT_PACKET_END -->'

// ── Extraction ─────────────────────────────────────────────────────────────

/**
 * Extract all problem vectors from a packet's materialized markdown.
 *
 * New format:
 * ```
 * ## Problem Vectors
 *
 * ### vector-id [state]
 * - **Current:** ...
 * - **Target:** ...
 * - **Approach:** ...
 * ```
 */
export function extractProblemVectors(packetContent: string): ProblemVectorState[] {
  // Find the Problem Vectors section
  const sectionMatch = packetContent.match(
    /## Problem Vectors\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return []

  const section = sectionMatch[1]
  const vectors: ProblemVectorState[] = []

  // Match each vector entry: ### id [state]
  const vectorPattern = /### (\S+) \[(\w+)\]\s*\n([\s\S]*?)(?=\n### |\n## |\n# |$)/g
  let match: RegExpExecArray | null
  while ((match = vectorPattern.exec(section)) !== null) {
    const id = match[1]
    const state = match[2] as NodeState
    const body = match[3]

    const currentMatch = body.match(/- \*\*Current:\*\*\s*(.+)/)
    const targetMatch = body.match(/- \*\*Target:\*\*\s*(.+)/)
    const approachMatch = body.match(/- \*\*Approach:\*\*\s*(.+)/)

    const current = currentMatch?.[1]?.trim() ?? ''
    const target = targetMatch?.[1]?.trim() ?? ''
    const approach = approachMatch?.[1]?.trim() ?? ''

    // Skip vectors that are all empty/placeholder
    if ((!current || current.startsWith('<!--')) &&
        (!target || target.startsWith('<!--')) &&
        (!approach || approach.startsWith('<!--'))) {
      continue
    }

    vectors.push({ id, current, target, approach, state })
  }

  return vectors
}

// ── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format injection content from problem vectors for CLAUDE.md.
 */
export function formatInjectionContent(
  name: string,
  vectors: ProblemVectorState[],
  packetPath: string,
): string {
  const lines: string[] = [
    `## Active Packet: ${name}`,
    `**Packet:** \`${packetPath}\``,
    '',
  ]

  if (vectors.length === 0) {
    lines.push('*No active problem vectors.*')
  } else {
    lines.push('### Problem Vectors')
    lines.push('')
    for (const v of vectors) {
      const stateIcon = v.state === 'success' ? '[done]' : v.state === 'failed' ? '[failed]' : '[active]'
      lines.push(`- **${v.id}** ${stateIcon}: ${v.current} --> ${v.target}`)
      lines.push(`  Approach: ${v.approach}`)
    }
  }

  lines.push('')
  lines.push('*Read the packet file for full context (whiteboard, AICCL nodes, delta log).*')

  return lines.join('\n')
}

// ── Inject / Remove ────────────────────────────────────────────────────────

/**
 * Inject or replace the packet managed section in a CLAUDE.md file.
 */
export function injectPacketIntoContent(
  fileContent: string,
  packetSection: string,
): string {
  const wrapped = `${PACKET_SECTION_START}\n${packetSection}\n${PACKET_SECTION_END}`
  const startIdx = fileContent.indexOf(PACKET_SECTION_START)
  const endIdx = fileContent.indexOf(PACKET_SECTION_END)

  if (startIdx === -1 || endIdx === -1) {
    return fileContent + '\n\n' + wrapped
  }

  return (
    fileContent.slice(0, startIdx) +
    wrapped +
    fileContent.slice(endIdx + PACKET_SECTION_END.length)
  )
}

/**
 * Remove the packet managed section from a CLAUDE.md file.
 */
export function removePacketSection(fileContent: string): string {
  const startIdx = fileContent.indexOf(PACKET_SECTION_START)
  const endIdx = fileContent.indexOf(PACKET_SECTION_END)

  if (startIdx === -1 || endIdx === -1) return fileContent

  const before = fileContent.slice(0, startIdx).replace(/\n+$/, '')
  const after = fileContent.slice(endIdx + PACKET_SECTION_END.length).replace(/^\n+/, '')

  return before + (after ? '\n\n' + after : '')
}
