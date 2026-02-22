import { describe, it, expect } from 'vitest'
import {
  zeroVector,
  vectorFrom,
  dot,
  norm,
  cosineSimilarity,
  euclideanDistance,
  addVectors,
  subtractVectors,
  scaleVector,
  normalizeVector,
  averageVectors,
  embedText,
  buildProblemState,
  buildSolutionEstimate,
  createTrajectory,
  appendStep,
  resolveTrajectory,
  measureProgress,
  DEFAULT_EMBEDDING_DIM,
} from '../../../src/memory/vector-state'

describe('vector operations', () => {
  describe('zeroVector', () => {
    it('creates a zero vector of given dimension', () => {
      const v = zeroVector(4)
      expect(v).toHaveLength(4)
      for (let i = 0; i < 4; i++) {
        expect(v[i]).toBe(0)
      }
    })
  })

  describe('vectorFrom', () => {
    it('creates Float32Array from number array', () => {
      const v = vectorFrom([1, 2, 3])
      expect(v).toBeInstanceOf(Float32Array)
      expect(v[0]).toBe(1)
      expect(v[1]).toBe(2)
      expect(v[2]).toBe(3)
    })
  })

  describe('dot', () => {
    it('computes dot product', () => {
      const a = vectorFrom([1, 2, 3])
      const b = vectorFrom([4, 5, 6])
      expect(dot(a, b)).toBe(32)
    })

    it('throws on dimension mismatch', () => {
      expect(() => dot(vectorFrom([1, 2]), vectorFrom([1, 2, 3]))).toThrow('dimension mismatch')
    })
  })

  describe('norm', () => {
    it('computes L2 norm', () => {
      const v = vectorFrom([3, 4])
      expect(norm(v)).toBe(5)
    })

    it('returns 0 for zero vector', () => {
      expect(norm(zeroVector(3))).toBe(0)
    })
  })

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const v = vectorFrom([1, 2, 3])
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0)
    })

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity(vectorFrom([1, 0]), vectorFrom([0, 1]))).toBeCloseTo(0)
    })

    it('returns -1 for opposite vectors', () => {
      expect(cosineSimilarity(vectorFrom([1, 0]), vectorFrom([-1, 0]))).toBeCloseTo(-1)
    })

    it('returns 0 when either vector is zero', () => {
      expect(cosineSimilarity(zeroVector(3), vectorFrom([1, 2, 3]))).toBe(0)
    })
  })

  describe('euclideanDistance', () => {
    it('computes distance between vectors', () => {
      const a = vectorFrom([0, 0])
      const b = vectorFrom([3, 4])
      expect(euclideanDistance(a, b)).toBe(5)
    })

    it('returns 0 for identical vectors', () => {
      const v = vectorFrom([1, 2, 3])
      expect(euclideanDistance(v, v)).toBeCloseTo(0)
    })
  })

  describe('addVectors', () => {
    it('adds two vectors', () => {
      const result = addVectors(vectorFrom([1, 2]), vectorFrom([3, 4]))
      expect(result[0]).toBe(4)
      expect(result[1]).toBe(6)
    })
  })

  describe('subtractVectors', () => {
    it('subtracts vectors', () => {
      const result = subtractVectors(vectorFrom([5, 3]), vectorFrom([1, 2]))
      expect(result[0]).toBe(4)
      expect(result[1]).toBe(1)
    })
  })

  describe('scaleVector', () => {
    it('scales a vector by a scalar', () => {
      const result = scaleVector(vectorFrom([1, 2, 3]), 2)
      expect(result[0]).toBe(2)
      expect(result[1]).toBe(4)
      expect(result[2]).toBe(6)
    })
  })

  describe('normalizeVector', () => {
    it('normalizes to unit length', () => {
      const v = normalizeVector(vectorFrom([3, 4]))
      expect(norm(v)).toBeCloseTo(1.0)
    })

    it('returns zero vector for zero input', () => {
      const v = normalizeVector(zeroVector(3))
      expect(norm(v)).toBe(0)
    })
  })

  describe('averageVectors', () => {
    it('computes element-wise average', () => {
      const avg = averageVectors([vectorFrom([2, 4]), vectorFrom([4, 6])])
      expect(avg[0]).toBe(3)
      expect(avg[1]).toBe(5)
    })

    it('throws for empty array', () => {
      expect(() => averageVectors([])).toThrow('Cannot average zero vectors')
    })
  })
})

describe('embedText', () => {
  it('returns a vector of the specified dimension', () => {
    const v = embedText('hello world', 64)
    expect(v).toHaveLength(64)
  })

  it('returns a normalized vector', () => {
    const v = embedText('hello world')
    expect(norm(v)).toBeCloseTo(1.0, 3)
  })

  it('produces similar embeddings for similar texts', () => {
    const a = embedText('fix bug in authentication')
    const b = embedText('fix bug in auth')
    const c = embedText('deploy to production server')

    const simAB = cosineSimilarity(a, b)
    const simAC = cosineSimilarity(a, c)

    expect(simAB).toBeGreaterThan(simAC)
  })

  it('uses DEFAULT_EMBEDDING_DIM by default', () => {
    const v = embedText('test')
    expect(v).toHaveLength(DEFAULT_EMBEDDING_DIM)
  })
})

describe('state builders', () => {
  const metadata = {
    description: 'fix auth bug',
    activeFiles: ['auth.ts'],
    activeFunctions: ['login()'],
    errors: ['401 unauthorized'],
    hypotheses: ['token expired'],
    toolsCalled: ['read_file'],
    phase: 'research' as const,
  }

  describe('buildProblemState', () => {
    it('creates a state with embedding', () => {
      const state = buildProblemState('s1', metadata)
      expect(state.id).toBe('s1')
      expect(state.embedding).toHaveLength(DEFAULT_EMBEDDING_DIM)
      expect(state.metadata.description).toBe('fix auth bug')
    })

    it('accepts custom dimension', () => {
      const state = buildProblemState('s1', metadata, { dim: 32 })
      expect(state.embedding).toHaveLength(32)
    })
  })

  describe('buildSolutionEstimate', () => {
    it('creates an estimate with embedding', () => {
      const est = buildSolutionEstimate({
        expectedFiles: ['auth.ts'],
        changeType: 'condition',
        expectedFileCount: { min: 1, max: 2 },
        expectedToolCalls: { min: 3, max: 10 },
        constraints: ['no breaking changes'],
      })
      expect(est.embedding).toHaveLength(DEFAULT_EMBEDDING_DIM)
      expect(est.confidence).toBe(0.5)
    })

    it('clamps confidence to [0, 1]', () => {
      const est = buildSolutionEstimate({
        expectedFiles: [],
        changeType: 'unknown',
        expectedFileCount: { min: 0, max: 0 },
        expectedToolCalls: { min: 0, max: 0 },
        constraints: [],
      }, 1.5)
      expect(est.confidence).toBe(1)
    })
  })
})

describe('trajectory operations', () => {
  function makeState(desc: string) {
    return buildProblemState(`state-${desc}`, {
      description: desc,
      activeFiles: [],
      activeFunctions: [],
      errors: [],
      hypotheses: [],
      toolsCalled: [],
      phase: 'research',
    })
  }

  function makeEstimate() {
    return buildSolutionEstimate({
      expectedFiles: ['target.ts'],
      changeType: 'condition',
      expectedFileCount: { min: 1, max: 1 },
      expectedToolCalls: { min: 1, max: 5 },
      constraints: [],
    })
  }

  it('creates an empty trajectory', () => {
    const start = makeState('start problem')
    const estimate = makeEstimate()
    const traj = createTrajectory('t1', 's1', start, estimate)

    expect(traj.id).toBe('t1')
    expect(traj.sessionId).toBe('s1')
    expect(traj.deltas).toHaveLength(0)
    expect(traj.resolved).toBe(false)
  })

  it('appends steps', () => {
    const start = makeState('start problem')
    const estimate = makeEstimate()
    let traj = createTrajectory('t1', 's1', start, estimate)

    const next = makeState('after reading file')
    traj = appendStep(traj, next, {
      type: 'tool_call',
      toolName: 'read_file',
      summary: 'Read auth.ts',
      success: true,
      durationMs: 100,
    })

    expect(traj.deltas).toHaveLength(1)
    expect(traj.deltas[0]!.action.toolName).toBe('read_file')
  })

  it('resolves a trajectory', () => {
    const start = makeState('start')
    const estimate = makeEstimate()
    let traj = createTrajectory('t1', 's1', start, estimate)

    const next = makeState('after fix')
    traj = appendStep(traj, next, {
      type: 'tool_call',
      summary: 'Applied fix',
      success: true,
      durationMs: 200,
    })

    traj = resolveTrajectory(traj, true)
    expect(traj.resolved).toBe(true)
    expect(traj.outcome).toBeDefined()
    expect(traj.outcome!.success).toBe(true)
    expect(traj.outcome!.totalToolCalls).toBe(1)
  })

  it('measures progress', () => {
    const start = makeState('start')
    const estimate = makeEstimate()
    const traj = createTrajectory('t1', 's1', start, estimate)

    const progress = measureProgress(traj)
    expect(progress.overall).toBeGreaterThanOrEqual(0)
    expect(progress.overall).toBeLessThanOrEqual(1)
    expect(progress.isStuck).toBe(false)
  })
})
