/**
 * Pattern Learning from Trajectories
 *
 * Execution generates trajectories. Recurring deviations -> new patterns.
 * Better patterns -> better prediction -> better compression.
 *
 * Key concepts:
 *   - TrajectoryCapture: record full delta sequence per execution
 *   - DeviationAnalyzer: identify recurring deviations from known patterns
 *   - PatternExtractor: recurring deviations -> new archetype
 *   - CodebookUpdater: new pattern -> update codebook
 *   - Training data: deviation vectors as signal for improvement
 */

import {
  type EmbeddingVector,
  type Trajectory,
  euclideanDistance,
  averageVectors,
} from './vector-state'
import {
  type ExpectedTrajectory,
  type DeviationRecord,
  computeAllDeviations,
  calculateCompression,
} from './pattern-prediction'

// ─── Types ──────────────────────────────────────────────────────────────────

/** A captured trajectory with its deviation analysis */
export interface CapturedTrajectory {
  trajectoryId: string
  archetypeId: string
  success: boolean
  deviations: DeviationRecord[]
  compressionRatio: number
  averageDeviation: number
  timestamp: number
}

/** A cluster of similar deviations */
export interface DeviationCluster {
  id: string
  stepIndex: number
  centroid: EmbeddingVector
  count: number
  averageMagnitude: number
  sourceTrajectoryIds: string[]
}

/** A learned pattern extracted from recurring deviations */
export interface LearnedPattern {
  id: string
  sourceArchetypeId: string
  typicalStepIndex: number
  clusterId: string
  occurrences: number
  suggestedTrajectory: ExpectedTrajectory | null
  confidence: number
  timestamp: number
}

/** Training data record for model improvement */
export interface TrainingRecord {
  problemEmbedding: EmbeddingVector
  predictedArchetype: string
  actualSteps: Array<{
    delta: EmbeddingVector
    actionType: string
    toolName?: string
  }>
  success: boolean
  compressionRatio: number
}

/** Learning system configuration */
export interface LearningConfig {
  minClusterSize: number
  clusterThreshold: number
  minPatternConfidence: number
  maxNewPatterns: number
}

const DEFAULT_CONFIG: LearningConfig = {
  minClusterSize: 3,
  clusterThreshold: 1.0,
  minPatternConfidence: 0.6,
  maxNewPatterns: 5,
}

// ─── Trajectory Capture ─────────────────────────────────────────────────────

/** Capture a trajectory's deviations against its expected trajectory */
export function captureTrajectory(
  trajectory: Trajectory,
  expected: ExpectedTrajectory,
): CapturedTrajectory {
  const deviations = computeAllDeviations(trajectory, expected)
  const compression = calculateCompression(trajectory, expected)

  const avgDeviation = deviations.length > 0
    ? deviations.reduce((sum, d) => sum + d.residualMagnitude, 0) / deviations.length
    : 0

  return {
    trajectoryId: trajectory.id,
    archetypeId: expected.archetypeId,
    success: trajectory.outcome?.success ?? false,
    deviations,
    compressionRatio: compression.compressionRatio,
    averageDeviation: avgDeviation,
    timestamp: Date.now(),
  }
}

// ─── Deviation Analysis ─────────────────────────────────────────────────────

/** Cluster similar deviations across multiple captured trajectories */
export function clusterDeviations(
  captures: CapturedTrajectory[],
  config?: Partial<LearningConfig>,
): DeviationCluster[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const clusters: DeviationCluster[] = []

  // Group significant deviations by step index
  const byStep = new Map<number, Array<{ deviation: DeviationRecord; trajectoryId: string }>>()

  for (const capture of captures) {
    for (const deviation of capture.deviations) {
      if (!deviation.isSignificant) continue

      const existing = byStep.get(deviation.stepIndex) ?? []
      existing.push({ deviation, trajectoryId: capture.trajectoryId })
      byStep.set(deviation.stepIndex, existing)
    }
  }

  // For each step index, cluster similar deviations
  let clusterId = 0
  for (const [stepIndex, deviations] of byStep) {
    const stepClusters = greedyCluster(deviations, cfg.clusterThreshold)

    for (const cluster of stepClusters) {
      if (cluster.length < cfg.minClusterSize) continue

      const vectors = cluster.map(d => d.deviation.residual)
      const centroid = averageVectors(vectors)
      const avgMag = cluster.reduce((sum, d) => sum + d.deviation.residualMagnitude, 0) / cluster.length

      clusters.push({
        id: `cluster-${clusterId++}`,
        stepIndex,
        centroid,
        count: cluster.length,
        averageMagnitude: avgMag,
        sourceTrajectoryIds: cluster.map(d => d.trajectoryId),
      })
    }
  }

  return clusters
}

/** Greedy clustering: assign each deviation to nearest existing cluster or create new */
function greedyCluster(
  items: Array<{ deviation: DeviationRecord; trajectoryId: string }>,
  threshold: number,
): Array<Array<{ deviation: DeviationRecord; trajectoryId: string }>> {
  const clusters: Array<Array<{ deviation: DeviationRecord; trajectoryId: string }>> = []

  for (const item of items) {
    let assigned = false

    for (const cluster of clusters) {
      const representative = cluster[0]!.deviation.residual
      const dist = euclideanDistance(item.deviation.residual, representative)

      if (dist <= threshold) {
        cluster.push(item)
        assigned = true
        break
      }
    }

    if (!assigned) {
      clusters.push([item])
    }
  }

  return clusters
}

// ─── Pattern Extraction ─────────────────────────────────────────────────────

/** Extract new patterns from deviation clusters */
export function extractPatterns(
  clusters: DeviationCluster[],
  sourceArchetypeId: string,
  captures: CapturedTrajectory[],
  config?: Partial<LearningConfig>,
): LearnedPattern[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const patterns: LearnedPattern[] = []

  const sorted = [...clusters].sort((a, b) => b.count - a.count)

  for (const cluster of sorted.slice(0, cfg.maxNewPatterns)) {
    const consistency = 1 - (cluster.averageMagnitude / (cluster.averageMagnitude + 1))
    const sizeScore = Math.min(1, cluster.count / 10)
    const confidence = (consistency + sizeScore) / 2

    if (confidence < cfg.minPatternConfidence) continue

    let suggestedTrajectory: ExpectedTrajectory | null = null
    for (const trajId of cluster.sourceTrajectoryIds) {
      const capture = captures.find(c => c.trajectoryId === trajId && c.success)
      if (capture) {
        suggestedTrajectory = {
          archetypeId: `learned.${cluster.id}`,
          steps: [{
            index: 0,
            actionType: 'tool_call',
            expertDomain: 'unknown',
            description: `Learned deviation pattern at step ${cluster.stepIndex}`,
            expectedDelta: cluster.centroid,
            expectedProgress: 0.2,
            tolerance: cluster.averageMagnitude * 1.5,
          }],
          expectedToolCalls: { min: 1, max: 10 },
          baselineCompressionRatio: 0.5,
        }
        break
      }
    }

    patterns.push({
      id: `pattern-${cluster.id}`,
      sourceArchetypeId,
      typicalStepIndex: cluster.stepIndex,
      clusterId: cluster.id,
      occurrences: cluster.count,
      suggestedTrajectory,
      confidence,
      timestamp: Date.now(),
    })
  }

  return patterns
}

// ─── Codebook Update ────────────────────────────────────────────────────────

/** Generate a codebook update suggestion from learned patterns */
export function suggestCodebookUpdate(
  patterns: LearnedPattern[],
): Array<{
  action: 'add_archetype' | 'update_trajectory' | 'split_archetype'
  archetypeId: string
  description: string
  confidence: number
}> {
  const suggestions: Array<{
    action: 'add_archetype' | 'update_trajectory' | 'split_archetype'
    archetypeId: string
    description: string
    confidence: number
  }> = []

  for (const pattern of patterns) {
    if (pattern.occurrences >= 5 && pattern.confidence >= 0.7) {
      suggestions.push({
        action: 'add_archetype',
        archetypeId: pattern.id,
        description: `New archetype learned from ${pattern.occurrences} deviations at step ${pattern.typicalStepIndex} from ${pattern.sourceArchetypeId}`,
        confidence: pattern.confidence,
      })
    } else if (pattern.occurrences >= 3) {
      suggestions.push({
        action: 'update_trajectory',
        archetypeId: pattern.sourceArchetypeId,
        description: `Update expected trajectory: recurring deviation at step ${pattern.typicalStepIndex}`,
        confidence: pattern.confidence,
      })
    }
  }

  return suggestions
}

// ─── Training Data ──────────────────────────────────────────────────────────

/** Export training data from captured trajectories */
export function exportTrainingData(
  captures: CapturedTrajectory[],
  trajectories: Trajectory[],
): TrainingRecord[] {
  const records: TrainingRecord[] = []
  const trajMap = new Map(trajectories.map(t => [t.id, t]))

  for (const capture of captures) {
    const trajectory = trajMap.get(capture.trajectoryId)
    if (!trajectory) continue

    records.push({
      problemEmbedding: trajectory.startState.embedding,
      predictedArchetype: capture.archetypeId,
      actualSteps: trajectory.deltas.map(d => ({
        delta: d.delta,
        actionType: d.action.type,
        toolName: d.action.toolName,
      })),
      success: capture.success,
      compressionRatio: capture.compressionRatio,
    })
  }

  return records
}

/** Get learning statistics from captures */
export function getLearningStats(captures: CapturedTrajectory[]): {
  totalCaptures: number
  successRate: number
  averageCompressionRatio: number
  averageDeviation: number
  archetypeDistribution: Map<string, number>
} {
  const totalCaptures = captures.length
  const successCount = captures.filter(c => c.success).length

  const avgCompression = totalCaptures > 0
    ? captures.reduce((sum, c) => sum + c.compressionRatio, 0) / totalCaptures
    : 0

  const avgDeviation = totalCaptures > 0
    ? captures.reduce((sum, c) => sum + c.averageDeviation, 0) / totalCaptures
    : 0

  const archetypeDistribution = new Map<string, number>()
  for (const capture of captures) {
    archetypeDistribution.set(
      capture.archetypeId,
      (archetypeDistribution.get(capture.archetypeId) ?? 0) + 1,
    )
  }

  return {
    totalCaptures,
    successRate: totalCaptures > 0 ? successCount / totalCaptures : 0,
    averageCompressionRatio: avgCompression,
    averageDeviation: avgDeviation,
    archetypeDistribution,
  }
}
