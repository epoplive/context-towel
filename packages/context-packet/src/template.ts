// ============================================================================
// Packet Template — Generates the markdown structure for new packets
// ============================================================================

import type { CreatePacketOptions } from './types'

/**
 * Generate a new packet markdown file from template.
 *
 * Sections:
 * - Problem Vector (current → target + approach)
 * - Architecture (mermaid diagrams)
 * - Data Model (ERD diagrams)
 * - Patterns Applied (design patterns with rationale)
 * - Active Tasks (task blocks, optionally seeded from plan)
 * - Session Log (timestamped entries)
 * - Tried & Pivoted (rejected approaches with reasons)
 * - Linked (plan file, session refs, docs)
 */
export function generatePacketTemplate(
  name: string,
  options: CreatePacketOptions = {},
): string {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const lines: string[] = []

  lines.push(`# Packet: ${name}`)
  lines.push('')

  // Problem Vector
  lines.push('## Problem Vector')
  lines.push('**Current:** <!-- describe current broken/missing state -->')
  lines.push('**Target:** <!-- describe desired working state -->')
  lines.push('**Approach:** <!-- high-level strategy, patterns, key decisions -->')
  lines.push('')

  // Architecture
  lines.push('## Architecture')
  lines.push('')
  lines.push('<!-- Add architecture diagrams using ~~~diagram blocks with mermaid -->')
  lines.push('')

  // Data Model
  lines.push('## Data Model')
  lines.push('')
  lines.push('<!-- Add ERD diagrams using ~~~diagram blocks with mermaid -->')
  lines.push('')

  // Patterns Applied
  lines.push('## Patterns Applied')
  lines.push('')
  lines.push('<!-- List design patterns with rationale -->')
  lines.push('<!-- Example: **Repository Pattern** — abstracts data access behind clean interface -->')
  lines.push('')

  // Active Tasks
  lines.push('## Active Tasks')
  lines.push('')
  if (options.seedTasks) {
    lines.push(options.seedTasks)
  } else {
    lines.push('<!-- Add ~~~task blocks here -->')
  }
  lines.push('')

  // Session Log
  lines.push('## Session Log')
  if (options.planFileRef) {
    lines.push(`- [${now}] Created packet from plan: ${options.planFileRef}`)
  } else {
    lines.push(`- [${now}] Created packet`)
  }
  lines.push('')

  // Tried & Pivoted
  lines.push('## Tried & Pivoted')
  lines.push('')
  lines.push('<!-- Record rejected approaches with reasons -->')
  lines.push('<!-- Example: **passport.js** — too much magic, switched to explicit middleware chain -->')
  lines.push('')

  // Linked
  lines.push('## Linked')
  if (options.planFileRef) {
    lines.push(`- Plan: \`${options.planFileRef}\``)
  } else {
    lines.push('<!-- Link plan files, docs, session transcripts -->')
  }
  lines.push('')

  return lines.join('\n')
}
