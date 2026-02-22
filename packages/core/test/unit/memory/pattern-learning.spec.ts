import { describe, it, expect } from 'vitest'
import {
  captureTrajectory,
  clusterDeviations,
  extractPatterns,
  suggestCodebookUpdate,
  exportTrainingData,
  getLearningStats,
} from '../../../src/memory/pattern-learning'
import type { CapturedTrajectory, DeviationCluster } from '../../../src/memory/pattern-learning'
import type { ExpectedTrajectory } from '../../../src/memory/pattern-prediction'
import {
  vectorFrom,
  buildProblemState,
  buildSolutionEstimate,
  createTrajectory,
  appendStep,
  resolveTrajectory,
  norm,
} from '../../../src/memory/vector-state'
import type { Trajectory } from '../../../src/memory/vector-state'

function makeTrajectory(id: string, dim = 4): Trajectory {
  const state = buildProblemState(`s-${id}`, {
    description: `problem ${id}`,
    activeFiles: [],
    activeFunctions: [],
    errors: [],
    hypotheses: [],
    toolsCalled: [],
    phase: 'research',
  }, { dim })

  const estimate = buildSolutionEstimate({
    expectedFiles: [],
    changeType: 'unknown',
    expectedFileCount: { min: 0, max: 0 },
    expectedToolCalls: { min: 0, max: 0 },
    constraints: [],
  }, 0.5, dim)

  return createTrajectory(id, 's1', state, estimate)
}

function makeExpectedTrajectory(dim = 4): ExpectedTrajectory {
  return {
    archetypeId: 'test-archetype',
    steps: [
      {
        index: 0,
        actionType: 'tool_call',
        expertDomain: 'code',
        description: 'Step 1',
        expectedDelta: vectorFrom(new Array(dim).fill(0.1)),
        expectedProgress: 0.5,
        tolerance: 0.5,
      },
    ],
    expectedToolCalls: { min: 1, max: 3 },
    baselineCompressionRatio: 0.8,
  }
}

describe('pattern learning', () => {
  describe('captureTrajectory', () => {
    it('captures deviations from expected trajectory', () => {
      let traj = makeTrajectory('t1')
      const expected = makeExpectedTrajectory()

      // Add a step
      const next = buildProblemState('s2', {
        description: 'after step',
        activeFiles: [],
        activeFunctions: [],
        errors: [],
        hypotheses: [],
        toolsCalled: [],
        phase: 'execute',
      }, { dim: 4 })

      traj = appendStep(traj, next, {
        type: 'tool_call',
        summary: 'Tool call',
        success: true,
        durationMs: 100,
      })

      const captured = captureTrajectory(traj, expected)
      expect(captured.trajectoryId).toBe('t1')
      expect(captured.archetypeId).toBe('test-archetype')
      expect(captured.deviations).toHaveLength(1)
      expect(typeof captured.compressionRatio).toBe('number')
      expect(typeof captured.averageDeviation).toBe('number')
    })

    it('marks success based on trajectory outcome', () => {
      let traj = makeTrajectory('t1')
      traj = resolveTrajectory(traj, true)

      const captured = captureTrajectory(traj, makeExpectedTrajectory())
      expect(captured.success).toBe(true)
    })
  })

  describe('clusterDeviations', () => {
    it('returns empty for no significant deviations', () => {
      const captures: CapturedTrajectory[] = [{
        trajectoryId: 't1',
        archetypeId: 'a1',
        success: true,
        deviations: [{
          stepIndex: 0,
          predicted: vectorFrom([0.1, 0, 0, 0]),
          actual: vectorFrom([0.1, 0, 0, 0]),
          residual: vectorFrom([0, 0, 0, 0]),
          residualMagnitude: 0,
          isSignificant: false,
        }],
        compressionRatio: 1.0,
        averageDeviation: 0,
        timestamp: Date.now(),
      }]

      const clusters = clusterDeviations(captures)
      expect(clusters).toHaveLength(0)
    })

    it('clusters significant deviations by step index', () => {
      const residual = vectorFrom([0.5, 0.5, 0, 0])
      const captures: CapturedTrajectory[] = []

      // Create enough captures to meet minClusterSize (default 3)
      for (let i = 0; i < 4; i++) {
        captures.push({
          trajectoryId: `t${i}`,
          archetypeId: 'a1',
          success: true,
          deviations: [{
            stepIndex: 0,
            predicted: vectorFrom([0.1, 0, 0, 0]),
            actual: vectorFrom([0.6, 0.5, 0, 0]),
            residual,
            residualMagnitude: norm(residual),
            isSignificant: true,
          }],
          compressionRatio: 0.5,
          averageDeviation: norm(residual),
          timestamp: Date.now(),
        })
      }

      const clusters = clusterDeviations(captures)
      expect(clusters.length).toBeGreaterThanOrEqual(1)
      expect(clusters[0]!.count).toBe(4)
      expect(clusters[0]!.stepIndex).toBe(0)
    })
  })

  describe('extractPatterns', () => {
    it('extracts patterns from high-confidence clusters', () => {
      const centroid = vectorFrom([0.5, 0.5, 0, 0])
      const clusters: DeviationCluster[] = [{
        id: 'cluster-0',
        stepIndex: 0,
        centroid,
        count: 10,
        averageMagnitude: 0.3,
        sourceTrajectoryIds: ['t1', 't2', 't3'],
      }]

      const captures: CapturedTrajectory[] = [{
        trajectoryId: 't1',
        archetypeId: 'a1',
        success: true,
        deviations: [],
        compressionRatio: 0.5,
        averageDeviation: 0.3,
        timestamp: Date.now(),
      }]

      const patterns = extractPatterns(clusters, 'a1', captures)
      expect(patterns.length).toBeGreaterThanOrEqual(1)
      expect(patterns[0]!.sourceArchetypeId).toBe('a1')
      expect(patterns[0]!.occurrences).toBe(10)
    })

    it('respects maxNewPatterns', () => {
      const clusters: DeviationCluster[] = []
      for (let i = 0; i < 10; i++) {
        clusters.push({
          id: `cluster-${i}`,
          stepIndex: i,
          centroid: vectorFrom([0.5, 0, 0, 0]),
          count: 10,
          averageMagnitude: 0.3,
          sourceTrajectoryIds: ['t1'],
        })
      }

      const patterns = extractPatterns(clusters, 'a1', [{
        trajectoryId: 't1',
        archetypeId: 'a1',
        success: true,
        deviations: [],
        compressionRatio: 0.5,
        averageDeviation: 0.3,
        timestamp: Date.now(),
      }], { maxNewPatterns: 3 })

      expect(patterns.length).toBeLessThanOrEqual(3)
    })
  })

  describe('suggestCodebookUpdate', () => {
    it('suggests add_archetype for high-confidence patterns', () => {
      const suggestions = suggestCodebookUpdate([{
        id: 'p1',
        sourceArchetypeId: 'a1',
        typicalStepIndex: 0,
        clusterId: 'c1',
        occurrences: 10,
        suggestedTrajectory: null,
        confidence: 0.8,
        timestamp: Date.now(),
      }])

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0]!.action).toBe('add_archetype')
    })

    it('suggests update_trajectory for moderate patterns', () => {
      const suggestions = suggestCodebookUpdate([{
        id: 'p1',
        sourceArchetypeId: 'a1',
        typicalStepIndex: 0,
        clusterId: 'c1',
        occurrences: 3,
        suggestedTrajectory: null,
        confidence: 0.5,
        timestamp: Date.now(),
      }])

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0]!.action).toBe('update_trajectory')
    })
  })

  describe('exportTrainingData', () => {
    it('exports training records from captures and trajectories', () => {
      let traj = makeTrajectory('t1')

      const next = buildProblemState('s2', {
        description: 'fixed',
        activeFiles: [],
        activeFunctions: [],
        errors: [],
        hypotheses: [],
        toolsCalled: [],
        phase: 'verify',
      }, { dim: 4 })

      traj = appendStep(traj, next, {
        type: 'tool_call',
        toolName: 'edit',
        summary: 'Fix',
        success: true,
        durationMs: 100,
      })
      traj = resolveTrajectory(traj, true)

      const captures: CapturedTrajectory[] = [{
        trajectoryId: 't1',
        archetypeId: 'a1',
        success: true,
        deviations: [],
        compressionRatio: 0.9,
        averageDeviation: 0.1,
        timestamp: Date.now(),
      }]

      const records = exportTrainingData(captures, [traj])
      expect(records).toHaveLength(1)
      expect(records[0]!.success).toBe(true)
      expect(records[0]!.actualSteps).toHaveLength(1)
    })
  })

  describe('getLearningStats', () => {
    it('returns stats from captures', () => {
      const captures: CapturedTrajectory[] = [
        { trajectoryId: 't1', archetypeId: 'a1', success: true, deviations: [], compressionRatio: 0.8, averageDeviation: 0.2, timestamp: Date.now() },
        { trajectoryId: 't2', archetypeId: 'a1', success: false, deviations: [], compressionRatio: 0.5, averageDeviation: 0.5, timestamp: Date.now() },
        { trajectoryId: 't3', archetypeId: 'a2', success: true, deviations: [], compressionRatio: 0.9, averageDeviation: 0.1, timestamp: Date.now() },
      ]

      const stats = getLearningStats(captures)
      expect(stats.totalCaptures).toBe(3)
      expect(stats.successRate).toBeCloseTo(2 / 3)
      expect(stats.averageCompressionRatio).toBeCloseTo((0.8 + 0.5 + 0.9) / 3)
      expect(stats.archetypeDistribution.get('a1')).toBe(2)
      expect(stats.archetypeDistribution.get('a2')).toBe(1)
    })

    it('handles empty captures', () => {
      const stats = getLearningStats([])
      expect(stats.totalCaptures).toBe(0)
      expect(stats.successRate).toBe(0)
    })
  })
})
