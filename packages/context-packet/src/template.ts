// ============================================================================
// Packet Template — Generates the materialized markdown for packets
// ============================================================================

import type { NodeState, NodeType, ZoomLayer, DeltaEntry, PacketEdge } from './types.js'

// ── Template types ─────────────────────────────────────────────────────────

export type CriterionMark = 'proven' | 'pending' | 'failed'
export type FactMark = 'established' | 'gap'

export interface VectorCriterion {
  text: string
  mark: CriterionMark
  /** Node ID that proves/disproves this criterion */
  proofRef?: string
}

export interface VectorFact {
  text: string
  mark: FactMark
}

export interface ProblemVectorState {
  id: string
  current: string
  target: string
  approach: string
  state: NodeState
  /** Structured solved criteria (optional, backward compat) */
  solvedCriteria?: VectorCriterion[]
  /** Structured problem facts (optional, backward compat) */
  problemFacts?: VectorFact[]
}

export interface NodeContent {
  id: string
  state: NodeState
  type?: NodeType
  path?: string
  layer?: ZoomLayer
  subsystem?: string
  maps?: string
  body: string
}

export interface GeneratePacketOptions {
  whiteboard?: Map<string, string>
  problemVectors?: ProblemVectorState[]
  nodes?: NodeContent[]
  edges?: PacketEdge[]
  deltas?: DeltaEntry[]
  linked?: { planFileRef?: string }
}

// ── Generator ──────────────────────────────────────────────────────────────

/**
 * Generate the full materialized markdown for a packet from structured data.
 *
 * Sections:
 * - Whiteboard (mermaid diagrams per section)
 * - Problem Vectors (structured vector entries with state)
 * - AICCL (~~~node blocks)
 * - Delta Log (recent mutations, most recent first)
 * - Linked (plan file refs)
 */
export function generatePacketMarkdown(
  name: string,
  options: GeneratePacketOptions = {},
): string {
  const lines: string[] = []

  lines.push(`# Packet: ${name}`)
  lines.push('')

  // ── Whiteboard ──────────────────────────────────────────────
  lines.push('## Whiteboard')
  lines.push('')
  if (options.whiteboard && options.whiteboard.size > 0) {
    for (const [section, mermaid] of options.whiteboard) {
      lines.push(`### ${section}`)
      lines.push('')
      lines.push('```mermaid')
      lines.push(mermaid)
      lines.push('```')
      lines.push('')
    }
  } else {
    lines.push('<!-- Add mermaid diagrams here -->')
    lines.push('')
  }

  // ── Problem Vectors ─────────────────────────────────────────
  lines.push('## Problem Vectors')
  lines.push('')
  if (options.problemVectors && options.problemVectors.length > 0) {
    for (const v of options.problemVectors) {
      lines.push(`### ${v.id} [${v.state}]`)
      lines.push(`- **Current:** ${v.current}`)
      lines.push(`- **Target:** ${v.target}`)
      lines.push(`- **Approach:** ${v.approach}`)

      // Render solved criteria if present
      if (v.solvedCriteria && v.solvedCriteria.length > 0) {
        lines.push('')
        lines.push('#### Solved Criteria')
        for (const c of v.solvedCriteria) {
          const check = c.mark === 'proven' ? 'x' : c.mark === 'failed' ? '!' : ' '
          const refSuffix = c.proofRef ? ` (proven by ${c.proofRef})` : ''
          lines.push(`- [${check}] ${c.text}${refSuffix}`)
        }
      }

      // Render problem facts if present
      if (v.problemFacts && v.problemFacts.length > 0) {
        lines.push('')
        lines.push('#### Problem Facts')
        for (const f of v.problemFacts) {
          lines.push(`- [${f.mark}] ${f.text}`)
        }
      }

      lines.push('')
    }
  } else {
    lines.push('<!-- No active problem vectors -->')
    lines.push('')
  }

  // ── AICCL ───────────────────────────────────────────────────
  // Build edge lookup: nodeId → list of connected node IDs
  const edgesByNode = new Map<string, string[]>()
  if (options.edges) {
    for (const edge of options.edges) {
      const sourceList = edgesByNode.get(edge.sourceNode) ?? []
      sourceList.push(edge.targetNode)
      edgesByNode.set(edge.sourceNode, sourceList)

      const targetList = edgesByNode.get(edge.targetNode) ?? []
      targetList.push(edge.sourceNode)
      edgesByNode.set(edge.targetNode, targetList)
    }
  }

  lines.push('## AICCL')
  lines.push('')
  if (options.nodes && options.nodes.length > 0) {
    for (const node of options.nodes) {
      lines.push('~~~node')
      lines.push(`id: ${node.id}`)
      lines.push(`state: ${node.state}`)
      if (node.type && node.type !== 'work') lines.push(`type: ${node.type}`)
      if (node.path) lines.push(`path: ${node.path}`)
      if (node.layer) lines.push(`layer: ${node.layer}`)
      if (node.subsystem) lines.push(`subsystem: ${node.subsystem}`)
      if (node.maps) lines.push(`maps: ${node.maps}`)
      const connected = edgesByNode.get(node.id)
      if (connected && connected.length > 0) {
        lines.push(`edges: ${connected.join(', ')}`)
      }
      lines.push('---')
      lines.push(node.body)
      lines.push('~~~')
      lines.push('')
    }
  } else {
    lines.push('<!-- No AICCL nodes -->')
    lines.push('')
  }

  // ── Delta Log ───────────────────────────────────────────────
  lines.push('## Delta Log')
  lines.push('')
  if (options.deltas && options.deltas.length > 0) {
    // Most recent first
    const sorted = [...options.deltas].sort((a, b) => b.timestamp - a.timestamp)
    for (const d of sorted) {
      const ts = new Date(d.timestamp).toISOString().slice(0, 19).replace('T', ' ')
      const nodeRef = d.nodeId ? ` [${d.nodeId}]` : ''
      lines.push(`- \`${ts}\` **${d.type}**${nodeRef}: ${d.content}`)
    }
    lines.push('')
  } else {
    lines.push('<!-- No deltas recorded -->')
    lines.push('')
  }

  // ── Linked ──────────────────────────────────────────────────
  lines.push('## Linked')
  lines.push('')
  if (options.linked?.planFileRef) {
    lines.push(`- Plan: \`${options.linked.planFileRef}\``)
  } else {
    lines.push('<!-- No linked files -->')
  }
  lines.push('')

  return lines.join('\n')
}
