import { describe, it, expect } from 'vitest'
import {
  createStore,
  captureKeyframe,
  getLatestKeyframe,
  getLatestSequence,
  appendDelta,
  reconstruct,
  reconstructAtStep,
  needsKeyframe,
  measureQuality,
  compact,
  getStorageSize,
} from '../../../src/memory/keyframe-delta'
import {
  buildProblemState,
  vectorFrom,
  addVectors,
  euclideanDistance,
} from '../../../src/memory/vector-state'

function makeState(desc: string, dim = 4) {
  return buildProblemState(`state-${desc}`, {
    description: desc,
    activeFiles: [],
    activeFunctions: [],
    errors: [],
    hypotheses: [],
    toolsCalled: [],
    phase: 'research',
  }, { dim })
}

describe('keyframe-delta compression', () => {
  describe('createStore', () => {
    it('creates an empty store with default config', () => {
      const store = createStore()
      expect(store.keyframes).toHaveLength(0)
      expect(store.sequences.size).toBe(0)
      expect(store.config.maxDeltasPerKeyframe).toBe(20)
    })

    it('accepts custom config', () => {
      const store = createStore({ maxDeltasPerKeyframe: 5 })
      expect(store.config.maxDeltasPerKeyframe).toBe(5)
    })
  })

  describe('captureKeyframe', () => {
    it('captures a keyframe from state', () => {
      let store = createStore()
      const state = makeState('initial')

      store = captureKeyframe(store, state, 0)

      expect(store.keyframes).toHaveLength(1)
      const kf = getLatestKeyframe(store)
      expect(kf).toBeDefined()
      expect(kf!.stepIndex).toBe(0)
      expect(kf!.metadata.description).toBe('initial')
    })

    it('creates an empty delta sequence', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('init'), 0)

      const seq = getLatestSequence(store)
      expect(seq).toBeDefined()
      expect(seq!.deltas).toHaveLength(0)
      expect(seq!.accumulatedDrift).toBe(0)
    })
  })

  describe('appendDelta', () => {
    it('appends a delta to the current sequence', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('init'), 0)
      store = appendDelta(store, vectorFrom([0.1, 0.2, 0.3, 0.4]), 1)

      const seq = getLatestSequence(store)
      expect(seq!.deltas).toHaveLength(1)
      expect(seq!.accumulatedDrift).toBeGreaterThan(0)
    })

    it('throws when no keyframe exists', () => {
      const store = createStore()
      expect(() => appendDelta(store, vectorFrom([0.1, 0.2, 0.3, 0.4]), 0))
        .toThrow('No keyframe exists')
    })
  })

  describe('reconstruct', () => {
    it('returns null for empty store', () => {
      expect(reconstruct(createStore())).toBeNull()
    })

    it('returns keyframe embedding when no deltas', () => {
      let store = createStore()
      const state = makeState('init')
      store = captureKeyframe(store, state, 0)

      const result = reconstruct(store)
      expect(result).toBeDefined()
      expect(result!.deltaCount).toBe(0)
      expect(result!.estimatedError).toBe(0)
      expect(result!.withinBounds).toBe(true)
    })

    it('applies deltas to keyframe', () => {
      let store = createStore()
      const state = makeState('init')
      store = captureKeyframe(store, state, 0)

      const delta = vectorFrom([0.1, 0.0, 0.0, 0.0])
      store = appendDelta(store, delta, 1)

      const result = reconstruct(store)
      expect(result).toBeDefined()
      expect(result!.deltaCount).toBe(1)

      // Reconstructed = keyframe + delta
      const kf = getLatestKeyframe(store)!
      const expected = addVectors(kf.embedding, delta)
      expect(euclideanDistance(result!.embedding, expected)).toBeCloseTo(0, 4)
    })
  })

  describe('reconstructAtStep', () => {
    it('returns null when no keyframe before step', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('init'), 5)
      expect(reconstructAtStep(store, 3)).toBeNull()
    })

    it('applies only deltas up to the target step', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('init'), 0)
      store = appendDelta(store, vectorFrom([0.1, 0, 0, 0]), 1)
      store = appendDelta(store, vectorFrom([0, 0.2, 0, 0]), 2)
      store = appendDelta(store, vectorFrom([0, 0, 0.3, 0]), 3)

      const result = reconstructAtStep(store, 2)
      expect(result).toBeDefined()
      expect(result!.deltaCount).toBe(2) // Only deltas at step 1 and 2
    })
  })

  describe('needsKeyframe', () => {
    it('returns true when no sequence exists', () => {
      expect(needsKeyframe(createStore())).toBe(true)
    })

    it('returns false for fresh store', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('init'), 0)
      expect(needsKeyframe(store)).toBe(false)
    })

    it('returns true when max deltas reached', () => {
      let store = createStore({ maxDeltasPerKeyframe: 2 })
      store = captureKeyframe(store, makeState('init'), 0)
      store = appendDelta(store, vectorFrom([0.1, 0, 0, 0]), 1)
      store = appendDelta(store, vectorFrom([0, 0.1, 0, 0]), 2)
      expect(needsKeyframe(store)).toBe(true)
    })

    it('returns true when max drift exceeded', () => {
      let store = createStore({ maxDrift: 0.5 })
      store = captureKeyframe(store, makeState('init'), 0)
      // Large delta that exceeds drift threshold
      store = appendDelta(store, vectorFrom([1, 1, 1, 1]), 1)
      expect(needsKeyframe(store)).toBe(true)
    })
  })

  describe('measureQuality', () => {
    it('returns infinity error for empty store', () => {
      const result = measureQuality(createStore(), vectorFrom([1, 0, 0, 0]))
      expect(result.error).toBe(Infinity)
      expect(result.withinBounds).toBe(false)
    })

    it('returns low error for exact reconstruction', () => {
      let store = createStore()
      const state = makeState('init')
      store = captureKeyframe(store, state, 0)

      const result = measureQuality(store, state.embedding)
      expect(result.error).toBeCloseTo(0, 4)
      expect(result.withinBounds).toBe(true)
    })
  })

  describe('compact', () => {
    it('keeps only the latest N keyframes', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('a'), 0)
      store = captureKeyframe(store, makeState('b'), 1)
      store = captureKeyframe(store, makeState('c'), 2)
      store = captureKeyframe(store, makeState('d'), 3)
      store = captureKeyframe(store, makeState('e'), 4)

      store = compact(store, 2)
      expect(store.keyframes).toHaveLength(2)
      expect(store.sequences.size).toBe(2)
    })

    it('no-ops when keyframes are within limit', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('a'), 0)
      store = captureKeyframe(store, makeState('b'), 1)

      store = compact(store, 3)
      expect(store.keyframes).toHaveLength(2)
    })
  })

  describe('getStorageSize', () => {
    it('counts keyframes and deltas', () => {
      let store = createStore()
      store = captureKeyframe(store, makeState('a'), 0)
      store = appendDelta(store, vectorFrom([0.1, 0, 0, 0]), 1)
      store = appendDelta(store, vectorFrom([0, 0.1, 0, 0]), 2)

      const size = getStorageSize(store)
      expect(size.keyframeCount).toBe(1)
      expect(size.deltaCount).toBe(2)
      expect(size.totalVectors).toBe(3)
    })
  })
})
