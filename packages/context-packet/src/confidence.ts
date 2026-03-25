// ============================================================================
// Confidence Scoring & Knowledge Decay
//
// Every knowledge artifact carries a confidence score 0.0–1.0.
// Score decays across phase transitions unless the artifact was referenced.
// Failed approaches are exempt from decay (negative knowledge persists).
// ============================================================================

import type { NodeContent, VectorCriterion, VectorFact, CriterionMark } from './template.js'
import type { NodeState } from './types.js'

// ── Default confidence values ────────────────────────────────────────────────

/** Default confidence by node state */
export const NODE_CONFIDENCE_DEFAULTS: Record<NodeState, number> = {
  active: 0.5,
  success: 1.0,
  failed: 1.0, // failed approaches are valuable negative knowledge
}

/** Default confidence by criterion mark */
export const CRITERION_CONFIDENCE_DEFAULTS: Record<CriterionMark, number> = {
  proven: 1.0,
  pending: 0.5,
  failed: 0.8, // failed criteria still carry knowledge about what doesn't work
}

/** Default confidence by fact mark */
export const FACT_CONFIDENCE_DEFAULTS: Record<string, number> = {
  established: 1.0,
  gap: 0.3,
}

// ── Decay configuration ─────────────────────────────────────────────────────

export interface DecayConfig {
  /** Confidence lost per phase transition for unreferenced items (default: 0.1) */
  decayPerPhase: number
  /** Below this score, items are dimmed on canvas (default: 0.3) */
  dimThreshold: number
  /** Below this score, items are omitted from injection (default: 0.2) */
  omitThreshold: number
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  decayPerPhase: 0.1,
  dimThreshold: 0.3,
  omitThreshold: 0.2,
}

// ── Confidence resolution ───────────────────────────────────────────────────

/** Get effective confidence for a node, using default if not explicitly set */
export function resolveNodeConfidence(node: NodeContent): number {
  if (node.confidence !== undefined) return node.confidence
  return NODE_CONFIDENCE_DEFAULTS[node.state]
}

/** Get effective confidence for a criterion */
export function resolveCriterionConfidence(criterion: VectorCriterion): number {
  if (criterion.confidence !== undefined) return criterion.confidence
  return CRITERION_CONFIDENCE_DEFAULTS[criterion.mark]
}

/** Get effective confidence for a fact */
export function resolveFactConfidence(fact: VectorFact): number {
  if (fact.confidence !== undefined) return fact.confidence
  return FACT_CONFIDENCE_DEFAULTS[fact.mark] ?? 0.5
}

// ── Decay pass ──────────────────────────────────────────────────────────────

/** Items that were referenced during the last phase (exempt from decay) */
export interface DecayContext {
  /** Node IDs that were referenced/expanded during the last phase */
  referencedNodeIds: Set<string>
  /** Decay configuration */
  config: DecayConfig
}

/**
 * Apply decay to a set of nodes after a phase transition.
 *
 * Rules:
 * - Failed nodes are exempt (negative knowledge persists)
 * - Referenced nodes are exempt (recently used = still relevant)
 * - Success nodes decay slower (halved decay rate)
 * - Active unreferenced nodes decay at full rate
 * - Confidence never drops below 0
 *
 * Returns new node array (does not mutate input).
 */
export function applyNodeDecay(
  nodes: readonly NodeContent[],
  context: DecayContext,
): NodeContent[] {
  return nodes.map(node => {
    const current = resolveNodeConfidence(node)

    // Failed nodes never decay — they're valuable negative knowledge
    if (node.state === 'failed') {
      return { ...node, confidence: current }
    }

    // Referenced nodes don't decay
    if (context.referencedNodeIds.has(node.id)) {
      return { ...node, confidence: current }
    }

    // Success nodes decay at half rate
    const rate = node.state === 'success'
      ? context.config.decayPerPhase / 2
      : context.config.decayPerPhase

    const decayed = Math.max(0, current - rate)
    return { ...node, confidence: decayed }
  })
}

/**
 * Apply decay to criteria after a phase transition.
 * Proven criteria carry forward at full confidence.
 * Failed criteria are exempt (negative knowledge).
 * Pending criteria decay.
 */
export function applyCriteriaDecay(
  criteria: readonly VectorCriterion[],
  config: DecayConfig,
): VectorCriterion[] {
  return criteria.map(c => {
    const current = resolveCriterionConfidence(c)

    // Proven and failed criteria don't decay
    if (c.mark === 'proven' || c.mark === 'failed') {
      return { ...c, confidence: current }
    }

    // Pending criteria decay
    const decayed = Math.max(0, current - config.decayPerPhase)
    return { ...c, confidence: decayed }
  })
}

/**
 * Apply decay to facts after a phase transition.
 * Established facts decay slower (half rate).
 * Gaps decay at full rate.
 */
export function applyFactsDecay(
  facts: readonly VectorFact[],
  config: DecayConfig,
): VectorFact[] {
  return facts.map(f => {
    const current = resolveFactConfidence(f)

    const rate = f.mark === 'established'
      ? config.decayPerPhase / 2
      : config.decayPerPhase

    const decayed = Math.max(0, current - rate)
    return { ...f, confidence: decayed }
  })
}

// ── Filtering by confidence ─────────────────────────────────────────────────

/** Filter nodes for context injection — omit low-confidence items */
export function filterByConfidence<T extends { confidence?: number }>(
  items: readonly T[],
  threshold: number,
  defaultConfidence: number = 0.5,
): T[] {
  return items.filter(item => {
    const conf = item.confidence ?? defaultConfidence
    return conf >= threshold
  })
}

/** Classify items by confidence tier for rendering */
export type ConfidenceTier = 'solid' | 'normal' | 'dim' | 'omit'

export function classifyConfidence(
  confidence: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
): ConfidenceTier {
  if (confidence >= 0.8) return 'solid'
  if (confidence >= config.dimThreshold) return 'normal'
  if (confidence >= config.omitThreshold) return 'dim'
  return 'omit'
}

/**
 * Format a confidence annotation for compact injection.
 * Returns empty string if confidence is at default (saves tokens).
 */
export function formatConfidenceTag(confidence: number | undefined, defaultConf: number): string {
  if (confidence === undefined) return ''
  // Don't emit if at default value (within tolerance)
  if (Math.abs(confidence - defaultConf) < 0.05) return ''
  return ` {${confidence.toFixed(1)}}`
}
