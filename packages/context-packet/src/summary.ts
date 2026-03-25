// ============================================================================
// Hierarchical Summary Linking
//
// As packets accumulate deltas, older history compresses:
// - Recent deltas: full detail (last 5-10)
// - Phase summaries: one summary per completed phase
// - Epoch summaries: major milestones only
//
// Each summary links to its children for drill-down.
// ============================================================================

import type { DeltaEntry, DeltaType } from './types.js'

// ── Summary types ───────────────────────────────────────────────────────

export type SummaryLevel = 'delta' | 'phase' | 'epoch'

export interface PhaseSummary {
  id: string
  level: 'phase'
  /** Phase name or identifier */
  phaseName: string
  /** Timestamp range this summary covers */
  startTimestamp: number
  endTimestamp: number
  /** One-line summary of what happened in this phase */
  summary: string
  /** IDs of deltas summarized by this entry */
  childDeltaIds: string[]
  /** Key outcomes: successes, failures, discoveries */
  outcomes: SummaryOutcome[]
}

export interface EpochSummary {
  id: string
  level: 'epoch'
  /** Epoch name (e.g., "v1 implementation", "auth rewrite") */
  epochName: string
  /** Timestamp range */
  startTimestamp: number
  endTimestamp: number
  /** High-level summary */
  summary: string
  /** IDs of phase summaries in this epoch */
  childPhaseIds: string[]
}

export interface SummaryOutcome {
  type: DeltaType
  /** Node ID if applicable */
  nodeId?: string
  /** Brief description */
  text: string
}

// ── Summary generation ──────────────────────────────────────────────────

/**
 * Generate a phase summary from a set of deltas.
 * Groups by type and extracts key outcomes.
 */
export function generatePhaseSummary(
  phaseName: string,
  deltas: readonly DeltaEntry[],
): PhaseSummary {
  if (deltas.length === 0) {
    return {
      id: `phase-${phaseName}`,
      level: 'phase',
      phaseName,
      startTimestamp: Date.now(),
      endTimestamp: Date.now(),
      summary: 'Empty phase — no deltas recorded',
      childDeltaIds: [],
      outcomes: [],
    }
  }

  const sorted = [...deltas].sort((a, b) => a.timestamp - b.timestamp)
  const startTimestamp = sorted[0].timestamp
  const endTimestamp = sorted[sorted.length - 1].timestamp

  // Count by type
  const typeCounts = new Map<DeltaType, number>()
  for (const d of deltas) {
    typeCounts.set(d.type, (typeCounts.get(d.type) ?? 0) + 1)
  }

  // Build summary line
  const parts: string[] = []
  for (const [type, count] of typeCounts) {
    parts.push(`${count} ${type}${count > 1 ? 's' : ''}`)
  }
  const summary = `${phaseName}: ${parts.join(', ')}`

  // Extract key outcomes (successes, failures, promotions)
  const outcomes: SummaryOutcome[] = []
  for (const d of deltas) {
    if (d.type === 'success' || d.type === 'failure' || d.type === 'promotion') {
      const text = d.content.length > 80 ? d.content.slice(0, 77) + '...' : d.content
      outcomes.push({
        type: d.type,
        nodeId: d.nodeId,
        text,
      })
    }
  }

  return {
    id: `phase-${phaseName}`,
    level: 'phase',
    phaseName,
    startTimestamp,
    endTimestamp,
    summary,
    childDeltaIds: deltas.map(d => d.id),
    outcomes,
  }
}

/**
 * Generate an epoch summary from a set of phase summaries.
 */
export function generateEpochSummary(
  epochName: string,
  phases: readonly PhaseSummary[],
): EpochSummary {
  if (phases.length === 0) {
    return {
      id: `epoch-${epochName}`,
      level: 'epoch',
      epochName,
      startTimestamp: Date.now(),
      endTimestamp: Date.now(),
      summary: 'Empty epoch',
      childPhaseIds: [],
    }
  }

  const startTimestamp = Math.min(...phases.map(p => p.startTimestamp))
  const endTimestamp = Math.max(...phases.map(p => p.endTimestamp))

  // Aggregate outcomes across phases
  const totalOutcomes = phases.reduce((sum, p) => sum + p.outcomes.length, 0)
  const successCount = phases.reduce(
    (sum, p) => sum + p.outcomes.filter(o => o.type === 'success' || o.type === 'promotion').length,
    0,
  )
  const failCount = phases.reduce(
    (sum, p) => sum + p.outcomes.filter(o => o.type === 'failure').length,
    0,
  )

  const summary = `${epochName}: ${phases.length} phases, ${totalOutcomes} outcomes (${successCount} success, ${failCount} failed)`

  return {
    id: `epoch-${epochName}`,
    level: 'epoch',
    epochName,
    startTimestamp,
    endTimestamp,
    summary,
    childPhaseIds: phases.map(p => p.id),
  }
}

// ── Formatting ──────────────────────────────────────────────────────────

/**
 * Format a phase summary as compact markdown for injection.
 */
export function formatPhaseSummary(summary: PhaseSummary): string {
  const lines: string[] = [
    `**${summary.phaseName}** (${summary.childDeltaIds.length} deltas)`,
  ]

  if (summary.outcomes.length > 0) {
    for (const o of summary.outcomes) {
      const nodeRef = o.nodeId ? ` [${o.nodeId}]` : ''
      lines.push(`  - ${o.type}${nodeRef}: ${o.text}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format an epoch summary as compact markdown.
 */
export function formatEpochSummary(summary: EpochSummary): string {
  return `**${summary.epochName}** (${summary.childPhaseIds.length} phases): ${summary.summary}`
}

/**
 * Compress a delta history into a hierarchical view.
 *
 * Returns:
 * - recentDeltas: last N deltas at full detail
 * - phaseSummaries: older deltas grouped by phase
 * - epochSummaries: ancient deltas grouped by epoch
 */
export interface CompressedHistory {
  recentDeltas: DeltaEntry[]
  phaseSummaries: PhaseSummary[]
  epochSummaries: EpochSummary[]
}

export function compressHistory(
  deltas: readonly DeltaEntry[],
  options: {
    /** Number of recent deltas to keep at full detail (default: 5) */
    recentCount?: number
    /** Number of deltas per phase before epoch-summarizing (default: 20) */
    phaseSize?: number
  } = {},
): CompressedHistory {
  const recentCount = options.recentCount ?? 5
  const phaseSize = options.phaseSize ?? 20

  const sorted = [...deltas].sort((a, b) => b.timestamp - a.timestamp)

  // Split into recent (full detail) and older (summarized)
  const recentDeltas = sorted.slice(0, recentCount)
  const olderDeltas = sorted.slice(recentCount)

  // Group older deltas into phases (chunks of phaseSize)
  const phaseSummaries: PhaseSummary[] = []
  for (let i = 0; i < olderDeltas.length; i += phaseSize) {
    const chunk = olderDeltas.slice(i, i + phaseSize)
    const phaseNum = Math.floor(i / phaseSize) + 1
    phaseSummaries.push(generatePhaseSummary(`phase-${phaseNum}`, chunk))
  }

  // If we have many phase summaries, group into epochs
  const epochSummaries: EpochSummary[] = []
  if (phaseSummaries.length > 3) {
    // All but the most recent phase get epoch-summarized
    const epochPhases = phaseSummaries.slice(1)
    epochSummaries.push(generateEpochSummary('earlier-work', epochPhases))
    // Keep only the most recent phase summary
    phaseSummaries.splice(1)
  }

  return { recentDeltas, phaseSummaries, epochSummaries }
}
