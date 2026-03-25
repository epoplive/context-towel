import { describe, it, expect } from 'vitest'
import {
  generatePhaseSummary,
  generateEpochSummary,
  formatPhaseSummary,
  formatEpochSummary,
  compressHistory,
} from '../../src/summary'
import type { DeltaEntry } from '../../src/types'

function makeDelta(overrides: Partial<DeltaEntry> = {}): DeltaEntry {
  return {
    id: `delta-${Math.random().toString(36).slice(2, 8)}`,
    packetName: 'test',
    timestamp: Date.now(),
    type: 'discovery',
    content: 'Found something',
    ...overrides,
  }
}

describe('generatePhaseSummary', () => {
  it('creates summary from deltas', () => {
    const deltas = [
      makeDelta({ type: 'discovery', content: 'Found auth issue' }),
      makeDelta({ type: 'success', content: 'Fixed auth flow', nodeId: 'fix-auth' }),
      makeDelta({ type: 'failure', content: 'Retry logic broken', nodeId: 'retry' }),
    ]

    const summary = generatePhaseSummary('auth-fix', deltas)

    expect(summary.level).toBe('phase')
    expect(summary.phaseName).toBe('auth-fix')
    expect(summary.childDeltaIds).toHaveLength(3)
    expect(summary.summary).toContain('auth-fix')
    expect(summary.outcomes).toHaveLength(2) // success + failure
    expect(summary.outcomes.find(o => o.type === 'success')).toBeDefined()
    expect(summary.outcomes.find(o => o.type === 'failure')).toBeDefined()
  })

  it('handles empty deltas', () => {
    const summary = generatePhaseSummary('empty', [])
    expect(summary.childDeltaIds).toHaveLength(0)
    expect(summary.summary).toContain('Empty phase')
  })

  it('truncates long content in outcomes', () => {
    const longContent = 'A'.repeat(200)
    const deltas = [makeDelta({ type: 'success', content: longContent })]
    const summary = generatePhaseSummary('long', deltas)
    expect(summary.outcomes[0].text.length).toBeLessThanOrEqual(80)
    expect(summary.outcomes[0].text).toContain('...')
  })

  it('computes correct timestamp range', () => {
    const deltas = [
      makeDelta({ timestamp: 1000 }),
      makeDelta({ timestamp: 3000 }),
      makeDelta({ timestamp: 2000 }),
    ]
    const summary = generatePhaseSummary('range', deltas)
    expect(summary.startTimestamp).toBe(1000)
    expect(summary.endTimestamp).toBe(3000)
  })
})

describe('generateEpochSummary', () => {
  it('creates epoch from phase summaries', () => {
    const phases = [
      generatePhaseSummary('phase-1', [
        makeDelta({ type: 'success', content: 'Win', timestamp: 1000 }),
      ]),
      generatePhaseSummary('phase-2', [
        makeDelta({ type: 'failure', content: 'Loss', timestamp: 2000 }),
      ]),
    ]

    const epoch = generateEpochSummary('v1', phases)
    expect(epoch.level).toBe('epoch')
    expect(epoch.epochName).toBe('v1')
    expect(epoch.childPhaseIds).toHaveLength(2)
    expect(epoch.summary).toContain('2 phases')
    expect(epoch.summary).toContain('1 success')
    expect(epoch.summary).toContain('1 failed')
  })

  it('handles empty phases', () => {
    const epoch = generateEpochSummary('empty', [])
    expect(epoch.childPhaseIds).toHaveLength(0)
  })
})

describe('formatPhaseSummary', () => {
  it('formats with outcomes', () => {
    const summary = generatePhaseSummary('auth', [
      makeDelta({ type: 'success', content: 'Fixed login', nodeId: 'fix-login' }),
    ])
    const formatted = formatPhaseSummary(summary)
    expect(formatted).toContain('**auth**')
    expect(formatted).toContain('1 deltas')
    expect(formatted).toContain('[fix-login]')
    expect(formatted).toContain('Fixed login')
  })
})

describe('formatEpochSummary', () => {
  it('formats epoch', () => {
    const phases = [generatePhaseSummary('p1', [makeDelta()])]
    const epoch = generateEpochSummary('release', phases)
    const formatted = formatEpochSummary(epoch)
    expect(formatted).toContain('**release**')
    expect(formatted).toContain('1 phases')
  })
})

describe('compressHistory', () => {
  it('splits into recent and summarized', () => {
    const deltas: DeltaEntry[] = []
    for (let i = 0; i < 15; i++) {
      deltas.push(makeDelta({ timestamp: i * 1000 }))
    }

    const result = compressHistory(deltas, { recentCount: 5 })
    expect(result.recentDeltas).toHaveLength(5)
    expect(result.phaseSummaries.length).toBeGreaterThan(0)
  })

  it('keeps all deltas as recent when count is small', () => {
    const deltas = [makeDelta(), makeDelta(), makeDelta()]
    const result = compressHistory(deltas, { recentCount: 5 })
    expect(result.recentDeltas).toHaveLength(3)
    expect(result.phaseSummaries).toHaveLength(0)
  })

  it('creates epoch summaries for large histories', () => {
    const deltas: DeltaEntry[] = []
    for (let i = 0; i < 100; i++) {
      deltas.push(makeDelta({ timestamp: i * 1000, type: i % 3 === 0 ? 'success' : 'discovery' }))
    }

    const result = compressHistory(deltas, { recentCount: 5, phaseSize: 20 })
    expect(result.recentDeltas).toHaveLength(5)
    // The remaining 95 deltas get phased, then most phases get epoch-summarized
    expect(result.epochSummaries.length).toBeGreaterThan(0)
  })

  it('recent deltas are most recent first', () => {
    const deltas = [
      makeDelta({ timestamp: 1000 }),
      makeDelta({ timestamp: 3000 }),
      makeDelta({ timestamp: 2000 }),
    ]
    const result = compressHistory(deltas, { recentCount: 3 })
    expect(result.recentDeltas[0].timestamp).toBe(3000)
    expect(result.recentDeltas[1].timestamp).toBe(2000)
    expect(result.recentDeltas[2].timestamp).toBe(1000)
  })
})
