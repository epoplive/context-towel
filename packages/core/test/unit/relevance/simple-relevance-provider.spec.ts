import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SimpleRelevanceProvider } from '../../../src/relevance/simple-relevance-provider'
import type { ContextItem, RelevanceScoringOptions } from '../../../src/relevance/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ContextItem> & { id: string; name: string }): ContextItem {
  return {
    type: 'file',
    ...overrides,
  }
}

const HOUR_MS = 60 * 60 * 1000

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SimpleRelevanceProvider', () => {
  let provider: SimpleRelevanceProvider

  beforeEach(() => {
    provider = new SimpleRelevanceProvider()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Provider Identity ──────────────────────────────────────────────────

  it('has the correct provider name', () => {
    expect(provider.name).toBe('simple-heuristic')
  })

  // ── score() basics ────────────────────────────────────────────────────

  it('returns 0 for an item with no metadata and no query', () => {
    const item = makeItem({ id: '1', name: 'foo.ts' })
    const score = provider.score(item, {})
    expect(score).toBe(0)
  })

  it('scores items of various types consistently', () => {
    const types = ['file', 'function', 'class', 'variable', 'memory', 'conversation', 'skill'] as const
    const scores = types.map((type) => {
      const item = makeItem({ id: type, name: 'test', type, referenceCount: 5 })
      return provider.score(item, {})
    })
    // All types should get the same score since scoring is type-agnostic
    const first = scores[0]
    for (const s of scores) {
      expect(s).toBeCloseTo(first, 10)
    }
  })

  // ── Recency scoring ──────────────────────────────────────────────────

  it('gives high recency score to recently accessed items', () => {
    const now = Date.now()
    const recentItem = makeItem({ id: '1', name: 'recent', lastAccessed: now - 1000 })
    const oldItem = makeItem({ id: '2', name: 'old', lastAccessed: now - 24 * HOUR_MS })

    const opts: RelevanceScoringOptions = {}
    const recentScore = provider.score(recentItem, opts)
    const oldScore = provider.score(oldItem, opts)

    expect(recentScore).toBeGreaterThan(oldScore)
  })

  it('applies exponential decay with 1-hour half-life', () => {
    const now = Date.now()
    // Item accessed exactly 1 hour ago should have ~50% recency
    const item = makeItem({ id: '1', name: 'test', lastAccessed: now - HOUR_MS })

    // Score with recency-only weights
    const score = provider.score(item, {
      weights: { recency: 1.0, referenceCount: 0, nameSimilarity: 0 },
    })

    // Exponential decay: 2^(-1) = 0.5
    expect(score).toBeCloseTo(0.5, 2)
  })

  it('returns 0 recency for items with no lastAccessed', () => {
    const item = makeItem({ id: '1', name: 'test' })
    const score = provider.score(item, {
      weights: { recency: 1.0, referenceCount: 0, nameSimilarity: 0 },
    })
    expect(score).toBe(0)
  })

  it('returns 0 recency for items with lastAccessed = 0', () => {
    const item = makeItem({ id: '1', name: 'test', lastAccessed: 0 })
    const score = provider.score(item, {
      weights: { recency: 1.0, referenceCount: 0, nameSimilarity: 0 },
    })
    expect(score).toBe(0)
  })

  // ── Reference count scoring ──────────────────────────────────────────

  it('gives higher score to items with more references', () => {
    const fewRefs = makeItem({ id: '1', name: 'few', referenceCount: 2 })
    const manyRefs = makeItem({ id: '2', name: 'many', referenceCount: 50 })

    const opts: RelevanceScoringOptions = {
      weights: { recency: 0, referenceCount: 1.0, nameSimilarity: 0 },
    }

    expect(provider.score(manyRefs, opts)).toBeGreaterThan(provider.score(fewRefs, opts))
  })

  it('uses logarithmic scaling for reference counts', () => {
    // Logarithmic scaling means equal *absolute* increments yield diminishing returns.
    // Going from 0->10 refs should yield a larger score gain than 90->100 refs.
    const item0 = makeItem({ id: '0', name: 'a', referenceCount: 0 })
    const item10 = makeItem({ id: '1', name: 'b', referenceCount: 10 })
    const item90 = makeItem({ id: '2', name: 'c', referenceCount: 90 })
    const item100 = makeItem({ id: '3', name: 'd', referenceCount: 100 })

    const opts: RelevanceScoringOptions = {
      weights: { recency: 0, referenceCount: 1.0, nameSimilarity: 0 },
    }

    const s0 = provider.score(item0, opts)
    const s10 = provider.score(item10, opts)
    const s90 = provider.score(item90, opts)
    const s100 = provider.score(item100, opts)

    // First 10 refs should give more gain than going from 90 to 100
    const gap0to10 = s10 - s0
    const gap90to100 = s100 - s90
    expect(gap0to10).toBeGreaterThan(gap90to100)

    // All scores should be monotonically increasing
    expect(s10).toBeGreaterThan(s0)
    expect(s90).toBeGreaterThan(s10)
    expect(s100).toBeGreaterThan(s90)
  })

  it('returns 0 reference score for items with no referenceCount', () => {
    const item = makeItem({ id: '1', name: 'test' })
    const score = provider.score(item, {
      weights: { recency: 0, referenceCount: 1.0, nameSimilarity: 0 },
    })
    expect(score).toBe(0)
  })

  it('caps reference score at 1.0 for very high counts', () => {
    const item = makeItem({ id: '1', name: 'test', referenceCount: 10000 })
    const score = provider.score(item, {
      weights: { recency: 0, referenceCount: 1.0, nameSimilarity: 0 },
    })
    expect(score).toBeLessThanOrEqual(1.0)
  })

  // ── Name similarity scoring ──────────────────────────────────────────

  it('scores exact match highest (1.0)', () => {
    const item = makeItem({ id: '1', name: 'UserService' })
    const score = provider.score(item, {
      query: 'UserService',
      weights: { recency: 0, referenceCount: 0, nameSimilarity: 1.0 },
    })
    expect(score).toBe(1.0)
  })

  it('scores exact match case-insensitively', () => {
    const item = makeItem({ id: '1', name: 'UserService' })
    const score = provider.score(item, {
      query: 'userservice',
      weights: { recency: 0, referenceCount: 0, nameSimilarity: 1.0 },
    })
    expect(score).toBe(1.0)
  })

  it('scores starts-with at 0.8', () => {
    const item = makeItem({ id: '1', name: 'UserService' })
    const score = provider.score(item, {
      query: 'User',
      weights: { recency: 0, referenceCount: 0, nameSimilarity: 1.0 },
    })
    expect(score).toBeCloseTo(0.8, 2)
  })

  it('scores contains at 0.5', () => {
    const item = makeItem({ id: '1', name: 'UserService' })
    const score = provider.score(item, {
      query: 'Service',
      weights: { recency: 0, referenceCount: 0, nameSimilarity: 1.0 },
    })
    // "Service" is a substring but not a prefix
    expect(score).toBeCloseTo(0.5, 2)
  })

  it('scores no match at 0.0', () => {
    const item = makeItem({ id: '1', name: 'UserService' })
    const score = provider.score(item, {
      query: 'Database',
      weights: { recency: 0, referenceCount: 0, nameSimilarity: 1.0 },
    })
    expect(score).toBe(0)
  })

  it('returns 0 name similarity when no query is provided', () => {
    const item = makeItem({ id: '1', name: 'UserService' })
    const score = provider.score(item, {
      weights: { recency: 0, referenceCount: 0, nameSimilarity: 1.0 },
    })
    expect(score).toBe(0)
  })

  it('returns 0 name similarity for empty query string', () => {
    const item = makeItem({ id: '1', name: 'UserService' })
    const score = provider.score(item, {
      query: '',
      weights: { recency: 0, referenceCount: 0, nameSimilarity: 1.0 },
    })
    expect(score).toBe(0)
  })

  // ── Combined scoring ─────────────────────────────────────────────────

  it('combines all three dimensions with default weights', () => {
    const now = Date.now()
    const item = makeItem({
      id: '1',
      name: 'UserService',
      lastAccessed: now, // just accessed => recency ~1.0
      referenceCount: 100, // many refs => high ref score
    })

    const score = provider.score(item, { query: 'UserService' })

    // recency ~1.0 * 0.3 = 0.3
    // refs ~1.0 * 0.3 = 0.3  (log2(101)/log2(101) = 1.0)
    // name = 1.0 * 0.4 = 0.4
    // total ~1.0
    expect(score).toBeGreaterThan(0.9)
  })

  // ── Custom weights ───────────────────────────────────────────────────

  it('respects custom weight overrides', () => {
    const now = Date.now()
    const item = makeItem({
      id: '1',
      name: 'test',
      lastAccessed: now,
      referenceCount: 50,
    })

    // Recency-only weights
    const recencyOnly = provider.score(item, {
      weights: { recency: 1.0, referenceCount: 0, nameSimilarity: 0 },
    })

    // Reference-only weights
    const refsOnly = provider.score(item, {
      weights: { recency: 0, referenceCount: 1.0, nameSimilarity: 0 },
    })

    // With default weights, both signals contribute
    const combined = provider.score(item, {})

    // recency-only should differ from refs-only since their raw values differ
    expect(recencyOnly).not.toBe(refsOnly)
    // Combined should be between the two (or near their sum * weights)
    expect(combined).toBeGreaterThan(0)
  })

  // ── rank() ───────────────────────────────────────────────────────────

  it('ranks items in descending order by score', () => {
    const now = Date.now()
    const items = [
      makeItem({ id: 'old', name: 'old', lastAccessed: now - 10 * HOUR_MS }),
      makeItem({ id: 'recent', name: 'recent', lastAccessed: now - 100 }),
      makeItem({ id: 'medium', name: 'medium', lastAccessed: now - 2 * HOUR_MS }),
    ]

    const ranked = provider.rank(items, {
      weights: { recency: 1.0, referenceCount: 0, nameSimilarity: 0 },
    })

    expect(ranked).toHaveLength(3)
    expect(ranked[0].item.id).toBe('recent')
    expect(ranked[1].item.id).toBe('medium')
    expect(ranked[2].item.id).toBe('old')

    // Scores should be in descending order
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score)
    }
  })

  it('limits results to maxResults', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `item-${i}`, referenceCount: i * 10 }),
    )

    const ranked = provider.rank(items, { maxResults: 3 })

    expect(ranked).toHaveLength(3)
  })

  it('returns all items when maxResults is not set', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `item-${i}` }),
    )

    const ranked = provider.rank(items, {})

    expect(ranked).toHaveLength(5)
  })

  it('returns all items when maxResults is 0', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `item-${i}` }),
    )

    const ranked = provider.rank(items, { maxResults: 0 })

    // maxResults: 0 means no limit (falsy)
    expect(ranked).toHaveLength(5)
  })

  it('includes reasons in ranked results', () => {
    const now = Date.now()
    const item = makeItem({
      id: '1',
      name: 'UserService',
      lastAccessed: now,
      referenceCount: 10,
    })

    const ranked = provider.rank([item], { query: 'User' })

    expect(ranked).toHaveLength(1)
    expect(ranked[0].reasons.length).toBeGreaterThan(0)
    expect(ranked[0].reasons.some((r) => r.includes('recency'))).toBe(true)
    expect(ranked[0].reasons.some((r) => r.includes('references'))).toBe(true)
    expect(ranked[0].reasons.some((r) => r.includes('name similarity'))).toBe(true)
  })

  it('includes "no matching signals" reason when score is zero', () => {
    const item = makeItem({ id: '1', name: 'test' })
    const ranked = provider.rank([item], {})

    expect(ranked[0].reasons).toContain('no matching signals')
  })

  // ── Edge cases ───────────────────────────────────────────────────────

  it('handles empty items array in rank()', () => {
    const ranked = provider.rank([], { query: 'anything' })
    expect(ranked).toEqual([])
  })

  it('clamps score to [0, 1] even with extreme weights', () => {
    const now = Date.now()
    const item = makeItem({
      id: '1',
      name: 'UserService',
      lastAccessed: now,
      referenceCount: 10000,
    })

    // Give absurd weights — score should still be capped at 1
    const score = provider.score(item, {
      query: 'UserService',
      weights: { recency: 5.0, referenceCount: 5.0, nameSimilarity: 5.0 },
    })

    expect(score).toBeLessThanOrEqual(1.0)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('handles items with only tags and metadata (no scoring signals)', () => {
    const item = makeItem({
      id: '1',
      name: 'tagged',
      tags: ['important', 'core'],
      metadata: { category: 'critical' },
    })

    // Only query matching will contribute
    const score = provider.score(item, { query: 'tagged' })
    // Name is "tagged", query is "tagged" => exact match => 0.4 (default nameSimilarity weight)
    expect(score).toBeCloseTo(0.4, 2)
  })

  it('handles future lastAccessed timestamps gracefully', () => {
    const now = Date.now()
    const item = makeItem({
      id: '1',
      name: 'future',
      lastAccessed: now + HOUR_MS, // 1 hour in the future
    })

    const score = provider.score(item, {
      weights: { recency: 1.0, referenceCount: 0, nameSimilarity: 0 },
    })

    // Age is clamped to 0, so score should be 1.0 (2^0 = 1)
    expect(score).toBe(1.0)
  })
})
