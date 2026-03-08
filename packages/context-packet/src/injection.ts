// ============================================================================
// Problem Vector Injection — Extract and inject into CLAUDE.md
// ============================================================================

import type { ProblemVector } from './types'

export const PACKET_SECTION_START = '<!-- CONTEXT_PACKET_START -->'
export const PACKET_SECTION_END = '<!-- CONTEXT_PACKET_END -->'

/**
 * Extract the Problem Vector from a packet's markdown content.
 * Looks for the ## Problem Vector section and parses Current/Target/Approach lines.
 */
export function extractProblemVector(packetContent: string): ProblemVector | null {
  // Find the Problem Vector section
  const sectionMatch = packetContent.match(
    /## Problem Vector\s*\n([\s\S]*?)(?=\n## |\n# |$)/
  )
  if (!sectionMatch) return null

  const section = sectionMatch[1]

  const currentMatch = section.match(/\*\*Current:\*\*\s*(.+)/)
  const targetMatch = section.match(/\*\*Target:\*\*\s*(.+)/)
  const approachMatch = section.match(/\*\*Approach:\*\*\s*(.+)/)

  const current = currentMatch?.[1]?.trim() ?? ''
  const target = targetMatch?.[1]?.trim() ?? ''
  const approach = approachMatch?.[1]?.trim() ?? ''

  // If all fields are empty or just comment placeholders, return null
  if ((!current || current.startsWith('<!--')) &&
      (!target || target.startsWith('<!--')) &&
      (!approach || approach.startsWith('<!--'))) {
    return null
  }

  return { current, target, approach }
}

/**
 * Format a problem vector summary for injection into CLAUDE.md.
 */
export function formatProblemVectorSummary(
  name: string,
  vector: ProblemVector,
  packetPath: string,
): string {
  const lines: string[] = [
    `## Active Packet: ${name}`,
    `**Problem:** ${vector.current} → ${vector.target}`,
    `**Approach:** ${vector.approach}`,
    `**Packet:** \`${packetPath}\``,
    `*Read the packet file for full context (architecture diagrams, task board, session log).*`,
  ]
  return lines.join('\n')
}

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
