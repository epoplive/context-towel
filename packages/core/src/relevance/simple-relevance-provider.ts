/**
 * SimpleRelevanceProvider — default heuristic-based relevance scorer.
 *
 * Scores items using three dimensions:
 *   1. Recency — exponential decay from lastAccessed timestamp (half-life 1 hour)
 *   2. Reference count — logarithmic scaling of referenceCount
 *   3. Name similarity — case-insensitive exact/starts-with/contains matching
 *
 * This is the baseline implementation. Phase 2 replaces it with
 * @dm/physics-memory for vector/embedding-based scoring.
 */

import type {
  ContextItem,
  RankedContextItem,
  RelevanceScoringOptions,
  RelevanceScoringProvider,
  ScoringWeights,
} from './types'

// ─── Constants ─────────────────────────────────────────────────────────────

/** Exponential decay half-life for recency scoring: 1 hour in milliseconds. */
const RECENCY_HALF_LIFE_MS = 60 * 60 * 1000

/** Default weights when none are provided. */
const DEFAULT_WEIGHTS: Required<ScoringWeights> = {
  recency: 0.3,
  referenceCount: 0.3,
  nameSimilarity: 0.4,
}

// ─── Scoring Helpers ───────────────────────────────────────────────────────

/**
 * Compute recency score using exponential decay.
 * Returns 1.0 for "just now", decays toward 0 with half-life of 1 hour.
 * Returns 0 if no lastAccessed timestamp is available.
 */
function computeRecencyScore(lastAccessed: number | undefined, now: number): number {
  if (lastAccessed === undefined || lastAccessed === 0) return 0
  const ageMs = Math.max(0, now - lastAccessed)
  return Math.pow(2, -(ageMs / RECENCY_HALF_LIFE_MS))
}

/**
 * Compute reference count score using logarithmic scaling.
 * Uses log2(1 + count) / log2(1 + 100) as normalization, capped at 1.
 * Returns 0 if no referenceCount is available.
 */
function computeReferenceScore(referenceCount: number | undefined): number {
  if (referenceCount === undefined || referenceCount === 0) return 0
  const normalized = Math.log2(1 + referenceCount) / Math.log2(1 + 100)
  return Math.min(1, normalized)
}

/**
 * Compute name similarity score against a query string.
 * Returns 0 if no query is provided.
 *
 * Scoring tiers:
 *   1.0 — exact match (case-insensitive)
 *   0.8 — name starts with query
 *   0.5 — name contains query
 *   0.0 — no match
 */
function computeNameSimilarityScore(name: string, query: string | undefined): number {
  if (!query || query.length === 0) return 0

  const lowerName = name.toLowerCase()
  const lowerQuery = query.toLowerCase()

  if (lowerName === lowerQuery) return 1.0
  if (lowerName.startsWith(lowerQuery)) return 0.8
  if (lowerName.includes(lowerQuery)) return 0.5

  return 0
}

/**
 * Build human-readable reasons array explaining the score breakdown.
 */
function buildReasons(
  recencyScore: number,
  referenceScore: number,
  nameSimilarityScore: number,
  weights: Required<ScoringWeights>,
): string[] {
  const reasons: string[] = []

  if (weights.recency > 0 && recencyScore > 0) {
    reasons.push(`recency: ${(recencyScore * 100).toFixed(1)}% (weight ${weights.recency})`)
  }
  if (weights.referenceCount > 0 && referenceScore > 0) {
    reasons.push(`references: ${(referenceScore * 100).toFixed(1)}% (weight ${weights.referenceCount})`)
  }
  if (weights.nameSimilarity > 0 && nameSimilarityScore > 0) {
    const tier =
      nameSimilarityScore >= 1.0 ? 'exact match' :
      nameSimilarityScore >= 0.8 ? 'starts with query' :
      'contains query'
    reasons.push(`name similarity: ${tier} (weight ${weights.nameSimilarity})`)
  }

  if (reasons.length === 0) {
    reasons.push('no matching signals')
  }

  return reasons
}

// ─── Provider Implementation ───────────────────────────────────────────────

export class SimpleRelevanceProvider implements RelevanceScoringProvider {
  readonly name = 'simple-heuristic'

  /**
   * Score a single context item. Returns a value in [0, 1].
   */
  score(item: ContextItem, options: RelevanceScoringOptions): number {
    const weights = this.resolveWeights(options.weights)
    const now = Date.now()

    const recencyScore = computeRecencyScore(item.lastAccessed, now)
    const referenceScore = computeReferenceScore(item.referenceCount)
    const nameSimilarityScore = computeNameSimilarityScore(item.name, options.query)

    const combined =
      weights.recency * recencyScore +
      weights.referenceCount * referenceScore +
      weights.nameSimilarity * nameSimilarityScore

    // Clamp to [0, 1]
    return Math.min(1, Math.max(0, combined))
  }

  /**
   * Score and rank multiple items. Returns top `maxResults` items sorted
   * by score descending. Each result includes reasons explaining the score.
   */
  rank(items: ContextItem[], options: RelevanceScoringOptions): RankedContextItem[] {
    const weights = this.resolveWeights(options.weights)
    const now = Date.now()

    const scored: RankedContextItem[] = items.map((item) => {
      const recencyScore = computeRecencyScore(item.lastAccessed, now)
      const referenceScore = computeReferenceScore(item.referenceCount)
      const nameSimilarityScore = computeNameSimilarityScore(item.name, options.query)

      const combined =
        weights.recency * recencyScore +
        weights.referenceCount * referenceScore +
        weights.nameSimilarity * nameSimilarityScore

      const score = Math.min(1, Math.max(0, combined))
      const reasons = buildReasons(recencyScore, referenceScore, nameSimilarityScore, weights)

      return { item, score, reasons }
    })

    // Sort by score descending, stable for equal scores
    scored.sort((a, b) => b.score - a.score)

    // Apply maxResults limit
    if (options.maxResults !== undefined && options.maxResults > 0) {
      return scored.slice(0, options.maxResults)
    }

    return scored
  }

  /**
   * Merge user-provided weights with defaults.
   */
  private resolveWeights(overrides?: ScoringWeights): Required<ScoringWeights> {
    if (!overrides) return { ...DEFAULT_WEIGHTS }
    return {
      recency: overrides.recency ?? DEFAULT_WEIGHTS.recency,
      referenceCount: overrides.referenceCount ?? DEFAULT_WEIGHTS.referenceCount,
      nameSimilarity: overrides.nameSimilarity ?? DEFAULT_WEIGHTS.nameSimilarity,
    }
  }
}
