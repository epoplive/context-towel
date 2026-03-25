import { describe, it, expect } from 'vitest'
import {
  NODE_CONFIDENCE_DEFAULTS,
  CRITERION_CONFIDENCE_DEFAULTS,
  FACT_CONFIDENCE_DEFAULTS,
  DEFAULT_DECAY_CONFIG,
  resolveNodeConfidence,
  resolveCriterionConfidence,
  resolveFactConfidence,
  applyNodeDecay,
  applyCriteriaDecay,
  applyFactsDecay,
  filterByConfidence,
  classifyConfidence,
  formatConfidenceTag,
} from '../../src/confidence'
import type { NodeContent, VectorCriterion, VectorFact } from '../../src/template'
import type { DecayContext } from '../../src/confidence'

function makeNode(overrides: Partial<NodeContent> = {}): NodeContent {
  return { id: 'test-node', state: 'active', body: 'test body', ...overrides }
}

function makeCriterion(overrides: Partial<VectorCriterion> = {}): VectorCriterion {
  return { text: 'test criterion', mark: 'pending', ...overrides }
}

function makeFact(overrides: Partial<VectorFact> = {}): VectorFact {
  return { text: 'test fact', mark: 'established', ...overrides }
}

describe('resolveNodeConfidence', () => {
  it('returns explicit confidence when set', () => {
    expect(resolveNodeConfidence(makeNode({ confidence: 0.7 }))).toBe(0.7)
  })

  it('returns default for active nodes', () => {
    expect(resolveNodeConfidence(makeNode({ state: 'active' }))).toBe(0.5)
  })

  it('returns 1.0 for success nodes', () => {
    expect(resolveNodeConfidence(makeNode({ state: 'success' }))).toBe(1.0)
  })

  it('returns 1.0 for failed nodes (negative knowledge)', () => {
    expect(resolveNodeConfidence(makeNode({ state: 'failed' }))).toBe(1.0)
  })
})

describe('resolveCriterionConfidence', () => {
  it('returns 1.0 for proven', () => {
    expect(resolveCriterionConfidence(makeCriterion({ mark: 'proven' }))).toBe(1.0)
  })

  it('returns 0.5 for pending', () => {
    expect(resolveCriterionConfidence(makeCriterion({ mark: 'pending' }))).toBe(0.5)
  })

  it('returns 0.8 for failed', () => {
    expect(resolveCriterionConfidence(makeCriterion({ mark: 'failed' }))).toBe(0.8)
  })

  it('uses explicit confidence over default', () => {
    expect(resolveCriterionConfidence(makeCriterion({ mark: 'pending', confidence: 0.9 }))).toBe(0.9)
  })
})

describe('resolveFactConfidence', () => {
  it('returns 1.0 for established facts', () => {
    expect(resolveFactConfidence(makeFact({ mark: 'established' }))).toBe(1.0)
  })

  it('returns 0.3 for gaps', () => {
    expect(resolveFactConfidence(makeFact({ mark: 'gap' }))).toBe(0.3)
  })
})

describe('applyNodeDecay', () => {
  const context: DecayContext = {
    referencedNodeIds: new Set<string>(),
    config: DEFAULT_DECAY_CONFIG,
  }

  it('decays active unreferenced nodes', () => {
    const nodes = [makeNode({ state: 'active', confidence: 0.5 })]
    const result = applyNodeDecay(nodes, context)
    expect(result[0].confidence).toBeCloseTo(0.4)
  })

  it('does not decay failed nodes', () => {
    const nodes = [makeNode({ state: 'failed', confidence: 1.0 })]
    const result = applyNodeDecay(nodes, context)
    expect(result[0].confidence).toBe(1.0)
  })

  it('does not decay referenced nodes', () => {
    const ctx: DecayContext = {
      referencedNodeIds: new Set(['test-node']),
      config: DEFAULT_DECAY_CONFIG,
    }
    const nodes = [makeNode({ state: 'active', confidence: 0.5 })]
    const result = applyNodeDecay(nodes, ctx)
    expect(result[0].confidence).toBe(0.5)
  })

  it('decays success nodes at half rate', () => {
    const nodes = [makeNode({ state: 'success', confidence: 1.0 })]
    const result = applyNodeDecay(nodes, context)
    expect(result[0].confidence).toBeCloseTo(0.95)
  })

  it('confidence never drops below 0', () => {
    const nodes = [makeNode({ state: 'active', confidence: 0.05 })]
    const result = applyNodeDecay(nodes, context)
    expect(result[0].confidence).toBe(0)
  })

  it('does not mutate input', () => {
    const nodes = [makeNode({ state: 'active', confidence: 0.5 })]
    applyNodeDecay(nodes, context)
    expect(nodes[0].confidence).toBe(0.5)
  })
})

describe('applyCriteriaDecay', () => {
  it('does not decay proven criteria', () => {
    const criteria = [makeCriterion({ mark: 'proven', confidence: 1.0 })]
    const result = applyCriteriaDecay(criteria, DEFAULT_DECAY_CONFIG)
    expect(result[0].confidence).toBe(1.0)
  })

  it('does not decay failed criteria', () => {
    const criteria = [makeCriterion({ mark: 'failed', confidence: 0.8 })]
    const result = applyCriteriaDecay(criteria, DEFAULT_DECAY_CONFIG)
    expect(result[0].confidence).toBe(0.8)
  })

  it('decays pending criteria', () => {
    const criteria = [makeCriterion({ mark: 'pending', confidence: 0.5 })]
    const result = applyCriteriaDecay(criteria, DEFAULT_DECAY_CONFIG)
    expect(result[0].confidence).toBeCloseTo(0.4)
  })
})

describe('applyFactsDecay', () => {
  it('decays established facts at half rate', () => {
    const facts = [makeFact({ mark: 'established', confidence: 1.0 })]
    const result = applyFactsDecay(facts, DEFAULT_DECAY_CONFIG)
    expect(result[0].confidence).toBeCloseTo(0.95)
  })

  it('decays gaps at full rate', () => {
    const facts = [makeFact({ mark: 'gap', confidence: 0.3 })]
    const result = applyFactsDecay(facts, DEFAULT_DECAY_CONFIG)
    expect(result[0].confidence).toBeCloseTo(0.2)
  })
})

describe('filterByConfidence', () => {
  it('filters items below threshold', () => {
    const items = [
      { confidence: 0.8 },
      { confidence: 0.1 },
      { confidence: 0.5 },
    ]
    const result = filterByConfidence(items, 0.3)
    expect(result).toHaveLength(2)
    expect(result[0].confidence).toBe(0.8)
    expect(result[1].confidence).toBe(0.5)
  })

  it('uses default confidence for items without it', () => {
    const items = [{ confidence: undefined as number | undefined }]
    const result = filterByConfidence(items, 0.6, 0.5)
    expect(result).toHaveLength(0) // default 0.5 < threshold 0.6
  })
})

describe('classifyConfidence', () => {
  it('classifies high confidence as solid', () => {
    expect(classifyConfidence(0.9)).toBe('solid')
    expect(classifyConfidence(0.8)).toBe('solid')
  })

  it('classifies medium confidence as normal', () => {
    expect(classifyConfidence(0.5)).toBe('normal')
    expect(classifyConfidence(0.3)).toBe('normal')
  })

  it('classifies low confidence as dim', () => {
    expect(classifyConfidence(0.25)).toBe('dim')
  })

  it('classifies very low confidence as omit', () => {
    expect(classifyConfidence(0.1)).toBe('omit')
    expect(classifyConfidence(0)).toBe('omit')
  })
})

describe('formatConfidenceTag', () => {
  it('returns empty for undefined confidence', () => {
    expect(formatConfidenceTag(undefined, 0.5)).toBe('')
  })

  it('returns empty when close to default', () => {
    expect(formatConfidenceTag(0.5, 0.5)).toBe('')
    expect(formatConfidenceTag(0.52, 0.5)).toBe('')
  })

  it('returns tag when different from default', () => {
    expect(formatConfidenceTag(0.3, 0.5)).toBe(' {0.3}')
    expect(formatConfidenceTag(0.9, 0.5)).toBe(' {0.9}')
  })
})

describe('default constants', () => {
  it('NODE_CONFIDENCE_DEFAULTS covers all states', () => {
    expect(NODE_CONFIDENCE_DEFAULTS.active).toBeDefined()
    expect(NODE_CONFIDENCE_DEFAULTS.success).toBeDefined()
    expect(NODE_CONFIDENCE_DEFAULTS.failed).toBeDefined()
  })

  it('CRITERION_CONFIDENCE_DEFAULTS covers all marks', () => {
    expect(CRITERION_CONFIDENCE_DEFAULTS.proven).toBeDefined()
    expect(CRITERION_CONFIDENCE_DEFAULTS.pending).toBeDefined()
    expect(CRITERION_CONFIDENCE_DEFAULTS.failed).toBeDefined()
  })

  it('DEFAULT_DECAY_CONFIG has reasonable values', () => {
    expect(DEFAULT_DECAY_CONFIG.decayPerPhase).toBeGreaterThan(0)
    expect(DEFAULT_DECAY_CONFIG.decayPerPhase).toBeLessThan(0.5)
    expect(DEFAULT_DECAY_CONFIG.dimThreshold).toBeGreaterThan(DEFAULT_DECAY_CONFIG.omitThreshold)
  })
})
