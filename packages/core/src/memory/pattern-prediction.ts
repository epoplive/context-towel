/**
 * Pattern-Based Prediction Model
 *
 * The pattern archetype IS the prediction model. Given current position +
 * archetype, predict next step. The codec stores only the prediction error
 * (deviation from expected trajectory).
 *
 * Key concepts:
 *   - ExpectedTrajectory: what steps SHOULD happen for an archetype
 *   - predict(): given position + archetype -> expected next state
 *   - Deviation encoding: actual - predicted = stored delta
 *   - Compression ratio: if agent follows pattern -> delta ~ 0 -> minimal storage
 *   - Unknown pattern: everything is deviation -> triggers pattern learning
 *
 * Note: This is the extracted algorithmic core. The codebook integration
 * (buildExpectedTrajectory from ProblemArchetype) is left to consumers
 * since it depends on external archetype definitions.
 */

import {
  type EmbeddingVector,
  type StepDelta,
  type StepAction,
  type Trajectory,
  subtractVectors,
  addVectors,
  euclideanDistance,
  norm,
  zeroVector,
} from './vector-state'

// ─── Expected Trajectory ────────────────────────────────────────────────────

/** An expected step in the trajectory */
export interface ExpectedStep {
  index: number
  actionType: StepAction['type']
  toolName?: string
  expertDomain: string
  description: string
  expectedDelta: EmbeddingVector
  expectedProgress: number
  tolerance: number
}

/** Complete expected trajectory for an archetype */
export interface ExpectedTrajectory {
  archetypeId: string
  steps: ExpectedStep[]
  expectedToolCalls: { min: number; max: number }
  baselineCompressionRatio: number
}

/** Prediction result */
export interface Prediction {
  expectedDelta: EmbeddingVector
  expectedProgress: number
  confidence: number
  stepIndex: number
  description: string
  expectedActionType: StepAction['type']
  expectedToolName?: string
}

/** Deviation record -- actual vs predicted */
export interface DeviationRecord {
  stepIndex: number
  predicted: EmbeddingVector
  actual: EmbeddingVector
  residual: EmbeddingVector
  residualMagnitude: number
  isSignificant: boolean
}

/** Compression metrics for a trajectory */
export interface CompressionMetrics {
  totalSteps: number
  significantDeviations: number
  compressionRatio: number
  averageResidual: number
  predictionAccuracy: number
}

// ─── Prediction Engine ──────────────────────────────────────────────────────

/** Predict the next step given current trajectory and archetype */
export function predict(
  trajectory: Trajectory,
  expectedTrajectory: ExpectedTrajectory,
): Prediction {
  const currentStep = trajectory.deltas.length
  const totalExpected = expectedTrajectory.steps.length

  if (currentStep >= totalExpected) {
    return {
      expectedDelta: zeroVector(trajectory.currentState.embedding.length),
      expectedProgress: 0.1,
      confidence: 0.3,
      stepIndex: currentStep,
      description: 'Verification / wrap-up step',
      expectedActionType: 'tool_call',
      expectedToolName: 'bash',
    }
  }

  const expected = expectedTrajectory.steps[currentStep]!

  const positionConfidence = 1 - (currentStep / totalExpected) * 0.4

  let matchQuality = 1
  if (trajectory.deltas.length > 0) {
    const recentDeviations = trajectory.deltas.slice(-3)
    const avgDeviation = recentDeviations.reduce(
      (sum, d) => sum + d.deviationFromPrediction, 0,
    ) / recentDeviations.length
    matchQuality = Math.max(0, 1 - avgDeviation)
  }

  const confidence = positionConfidence * matchQuality

  return {
    expectedDelta: expected.expectedDelta,
    expectedProgress: expected.expectedProgress,
    confidence,
    stepIndex: currentStep,
    description: expected.description,
    expectedActionType: expected.actionType,
    expectedToolName: expected.toolName,
  }
}

// ─── Deviation Encoding ─────────────────────────────────────────────────────

/** Compute deviation between actual and predicted step */
export function computeDeviation(
  actualDelta: StepDelta,
  prediction: Prediction,
  expectedTrajectory: ExpectedTrajectory,
): DeviationRecord {
  const residual = subtractVectors(actualDelta.delta, prediction.expectedDelta)
  const residualMagnitude = norm(residual)

  const stepIdx = Math.min(actualDelta.stepIndex, expectedTrajectory.steps.length - 1)
  const tolerance = expectedTrajectory.steps[stepIdx]?.tolerance ?? 0.5

  return {
    stepIndex: actualDelta.stepIndex,
    predicted: prediction.expectedDelta,
    actual: actualDelta.delta,
    residual,
    residualMagnitude,
    isSignificant: residualMagnitude > tolerance,
  }
}

/** Compute all deviations for a trajectory */
export function computeAllDeviations(
  trajectory: Trajectory,
  expectedTrajectory: ExpectedTrajectory,
): DeviationRecord[] {
  const deviations: DeviationRecord[] = []

  for (const delta of trajectory.deltas) {
    const stepIndex = delta.stepIndex
    const totalExpected = expectedTrajectory.steps.length

    let prediction: Prediction
    if (stepIndex < totalExpected) {
      const expected = expectedTrajectory.steps[stepIndex]!
      prediction = {
        expectedDelta: expected.expectedDelta,
        expectedProgress: expected.expectedProgress,
        confidence: 1 - (stepIndex / totalExpected) * 0.4,
        stepIndex,
        description: expected.description,
        expectedActionType: expected.actionType,
        expectedToolName: expected.toolName,
      }
    } else {
      prediction = {
        expectedDelta: zeroVector(delta.delta.length),
        expectedProgress: 0.1,
        confidence: 0.3,
        stepIndex,
        description: 'Extra step beyond expected',
        expectedActionType: 'tool_call',
      }
    }

    deviations.push(computeDeviation(delta, prediction, expectedTrajectory))
  }

  return deviations
}

// ─── Compression Metrics ────────────────────────────────────────────────────

/** Calculate compression metrics for a trajectory vs expected */
export function calculateCompression(
  trajectory: Trajectory,
  expectedTrajectory: ExpectedTrajectory,
): CompressionMetrics {
  const deviations = computeAllDeviations(trajectory, expectedTrajectory)
  const totalSteps = deviations.length

  if (totalSteps === 0) {
    return {
      totalSteps: 0,
      significantDeviations: 0,
      compressionRatio: 1,
      averageResidual: 0,
      predictionAccuracy: 1,
    }
  }

  const significantDeviations = deviations.filter(d => d.isSignificant).length
  const compressionRatio = 1 - significantDeviations / totalSteps
  const averageResidual = deviations.reduce(
    (sum, d) => sum + d.residualMagnitude, 0,
  ) / totalSteps

  const predictionAccuracy = 1 - significantDeviations / totalSteps

  return {
    totalSteps,
    significantDeviations,
    compressionRatio,
    averageResidual,
    predictionAccuracy,
  }
}

// ─── Unknown Pattern Handling ───────────────────────────────────────────────

/** Detect if a trajectory represents an unknown pattern */
export function isUnknownPattern(
  trajectory: Trajectory,
  expectedTrajectory: ExpectedTrajectory,
  threshold: number = 0.3,
): boolean {
  const metrics = calculateCompression(trajectory, expectedTrajectory)
  return metrics.compressionRatio < threshold
}

/** Extract a new pattern from a successful trajectory */
export function extractPattern(
  trajectory: Trajectory,
): ExpectedTrajectory | null {
  if (!trajectory.resolved || !trajectory.outcome?.success) {
    return null
  }

  if (trajectory.deltas.length === 0) {
    return null
  }

  const steps: ExpectedStep[] = trajectory.deltas.map((delta, index) => ({
    index,
    actionType: delta.action.type,
    toolName: delta.action.toolName,
    expertDomain: 'unknown',
    description: delta.action.summary,
    expectedDelta: delta.delta,
    expectedProgress: delta.progress,
    tolerance: 0.5,
  }))

  return {
    archetypeId: `learned.${trajectory.id}`,
    steps,
    expectedToolCalls: {
      min: Math.max(1, steps.filter(s => s.actionType === 'tool_call').length - 1),
      max: steps.filter(s => s.actionType === 'tool_call').length + 2,
    },
    baselineCompressionRatio: 0.6,
  }
}

// ─── Reconstruction from Deviations ─────────────────────────────────────────

/** Reconstruct a trajectory from deviation records (predicted + residual = actual) */
export function reconstructTrajectory(
  deviations: DeviationRecord[],
): EmbeddingVector[] {
  const reconstructed: EmbeddingVector[] = []

  for (const deviation of deviations) {
    const actualDelta = addVectors(deviation.predicted, deviation.residual)
    reconstructed.push(actualDelta)
  }

  return reconstructed
}

/** Verify reconstruction accuracy */
export function verifyReconstruction(
  originalDeltas: StepDelta[],
  reconstructed: EmbeddingVector[],
  maxError: number = 1e-5,
): { accurate: boolean; maxObservedError: number } {
  let maxObservedError = 0

  for (let i = 0; i < Math.min(originalDeltas.length, reconstructed.length); i++) {
    const error = euclideanDistance(originalDeltas[i]!.delta, reconstructed[i]!)
    maxObservedError = Math.max(maxObservedError, error)
  }

  return {
    accurate: maxObservedError <= maxError,
    maxObservedError,
  }
}
