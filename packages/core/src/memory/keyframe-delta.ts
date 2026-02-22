/**
 * Keyframe + Delta Reconstruction
 *
 * Like video codecs: periodic full-state snapshots (I-frames) + deltas between them.
 * Reconstruction = keyframe + accumulated deltas -> current state.
 *
 * Key concepts:
 *   - Keyframe: full state snapshot (embeddable)
 *   - DeltaSequence: ordered deviation vectors since last keyframe
 *   - reconstruct(): keyframe + deltas -> current state
 *   - Drift detection: accumulated deltas diverge too far -> force new keyframe
 *   - Quality bounds: reconstruction error stays within threshold
 */

import {
  type EmbeddingVector,
  type ProblemStateVector,
  type ProblemStateMetadata,
  addVectors,
  euclideanDistance,
  norm,
} from './vector-state'

// ─── Types ──────────────────────────────────────────────────────────────────

/** A keyframe: full state snapshot at a point in time */
export interface Keyframe {
  id: string
  stepIndex: number
  timestamp: number
  embedding: EmbeddingVector
  metadata: ProblemStateMetadata
  archetypeId?: string
  confidence: number
}

/** A sequence of deltas since the last keyframe */
export interface DeltaSequence {
  keyframeId: string
  deltas: CompressedDelta[]
  accumulatedDrift: number
}

/** A compressed delta */
export interface CompressedDelta {
  stepIndex: number
  timestamp: number
  vector: EmbeddingVector
  isResidual: boolean
  magnitude: number
}

/** Reconstructed state from keyframe + deltas */
export interface ReconstructedState {
  embedding: EmbeddingVector
  keyframeId: string
  deltaCount: number
  estimatedError: number
  withinBounds: boolean
}

/** Configuration for keyframe/delta system */
export interface KeyframeDeltaConfig {
  maxDeltasPerKeyframe: number
  maxDrift: number
  qualityThreshold: number
  autoKeyframeInterval: number
}

const DEFAULT_CONFIG: KeyframeDeltaConfig = {
  maxDeltasPerKeyframe: 20,
  maxDrift: 5.0,
  qualityThreshold: 0.1,
  autoKeyframeInterval: 10,
}

/** A complete keyframe-delta store for one trajectory */
export interface KeyframeDeltaStore {
  keyframes: Keyframe[]
  sequences: Map<string, DeltaSequence>
  config: KeyframeDeltaConfig
}

// ─── Store Creation ─────────────────────────────────────────────────────────

/** Create a new keyframe-delta store */
export function createStore(config?: Partial<KeyframeDeltaConfig>): KeyframeDeltaStore {
  return {
    keyframes: [],
    sequences: new Map(),
    config: { ...DEFAULT_CONFIG, ...config },
  }
}

// ─── Keyframe Operations ────────────────────────────────────────────────────

/** Capture a keyframe from the current state */
export function captureKeyframe(
  store: KeyframeDeltaStore,
  state: ProblemStateVector,
  stepIndex: number,
  confidence: number = 0.5,
): KeyframeDeltaStore {
  const keyframe: Keyframe = {
    id: `kf-${stepIndex}-${Date.now()}`,
    stepIndex,
    timestamp: Date.now(),
    embedding: new Float32Array(state.embedding),
    metadata: { ...state.metadata },
    archetypeId: state.archetypeId,
    confidence,
  }

  const sequence: DeltaSequence = {
    keyframeId: keyframe.id,
    deltas: [],
    accumulatedDrift: 0,
  }

  const newKeyframes = [...store.keyframes, keyframe]
  const newSequences = new Map(store.sequences)
  newSequences.set(keyframe.id, sequence)

  return {
    ...store,
    keyframes: newKeyframes,
    sequences: newSequences,
  }
}

/** Get the latest keyframe */
export function getLatestKeyframe(store: KeyframeDeltaStore): Keyframe | undefined {
  return store.keyframes[store.keyframes.length - 1]
}

/** Get the latest delta sequence */
export function getLatestSequence(store: KeyframeDeltaStore): DeltaSequence | undefined {
  const latest = getLatestKeyframe(store)
  if (!latest) return undefined
  return store.sequences.get(latest.id)
}

// ─── Delta Operations ───────────────────────────────────────────────────────

/** Append a delta to the current sequence */
export function appendDelta(
  store: KeyframeDeltaStore,
  delta: EmbeddingVector,
  stepIndex: number,
  isResidual: boolean = false,
): KeyframeDeltaStore {
  const latestKeyframe = getLatestKeyframe(store)
  if (!latestKeyframe) {
    throw new Error('No keyframe exists. Capture a keyframe first.')
  }

  const sequence = store.sequences.get(latestKeyframe.id)
  if (!sequence) {
    throw new Error(`No sequence for keyframe ${latestKeyframe.id}`)
  }

  const magnitude = norm(delta)
  const compressed: CompressedDelta = {
    stepIndex,
    timestamp: Date.now(),
    vector: new Float32Array(delta),
    isResidual,
    magnitude,
  }

  const newDeltas = [...sequence.deltas, compressed]
  const newDrift = sequence.accumulatedDrift + magnitude

  const newSequence: DeltaSequence = {
    ...sequence,
    deltas: newDeltas,
    accumulatedDrift: newDrift,
  }

  const newSequences = new Map(store.sequences)
  newSequences.set(latestKeyframe.id, newSequence)

  return {
    ...store,
    sequences: newSequences,
  }
}

// ─── Reconstruction ─────────────────────────────────────────────────────────

/** Reconstruct the current state from keyframe + deltas */
export function reconstruct(store: KeyframeDeltaStore): ReconstructedState | null {
  const latestKeyframe = getLatestKeyframe(store)
  if (!latestKeyframe) return null

  const sequence = store.sequences.get(latestKeyframe.id)
  if (!sequence) return null

  let current: EmbeddingVector = new Float32Array(latestKeyframe.embedding) as EmbeddingVector

  for (const delta of sequence.deltas) {
    current = addVectors(current, delta.vector)
  }

  const estimatedError = sequence.accumulatedDrift * 0.01 * sequence.deltas.length

  return {
    embedding: current,
    keyframeId: latestKeyframe.id,
    deltaCount: sequence.deltas.length,
    estimatedError,
    withinBounds: estimatedError <= store.config.qualityThreshold,
  }
}

/** Reconstruct state at a specific step index */
export function reconstructAtStep(
  store: KeyframeDeltaStore,
  stepIndex: number,
): ReconstructedState | null {
  let bestKeyframe: Keyframe | undefined
  for (const kf of store.keyframes) {
    if (kf.stepIndex <= stepIndex) {
      bestKeyframe = kf
    }
  }

  if (!bestKeyframe) return null

  const sequence = store.sequences.get(bestKeyframe.id)
  if (!sequence) return null

  let current: EmbeddingVector = new Float32Array(bestKeyframe.embedding) as EmbeddingVector
  let deltaCount = 0
  let accDrift = 0

  for (const delta of sequence.deltas) {
    if (delta.stepIndex > stepIndex) break
    current = addVectors(current, delta.vector)
    accDrift += delta.magnitude
    deltaCount++
  }

  const estimatedError = accDrift * 0.01 * deltaCount

  return {
    embedding: current,
    keyframeId: bestKeyframe.id,
    deltaCount,
    estimatedError,
    withinBounds: estimatedError <= store.config.qualityThreshold,
  }
}

// ─── Drift Detection ────────────────────────────────────────────────────────

/** Check if the current sequence has drifted too far (needs new keyframe) */
export function needsKeyframe(store: KeyframeDeltaStore): boolean {
  const sequence = getLatestSequence(store)
  if (!sequence) return true

  const cfg = store.config

  if (sequence.deltas.length >= cfg.maxDeltasPerKeyframe) return true
  if (sequence.accumulatedDrift >= cfg.maxDrift) return true

  if (sequence.deltas.length > 0) {
    const latestKeyframe = getLatestKeyframe(store)
    if (latestKeyframe) {
      const lastDelta = sequence.deltas[sequence.deltas.length - 1]!
      if (lastDelta.stepIndex - latestKeyframe.stepIndex >= cfg.autoKeyframeInterval) {
        return true
      }
    }
  }

  return false
}

/** Calculate the current reconstruction quality */
export function measureQuality(
  store: KeyframeDeltaStore,
  actualState: EmbeddingVector,
): { error: number; withinBounds: boolean } {
  const reconstructed = reconstruct(store)
  if (!reconstructed) {
    return { error: Infinity, withinBounds: false }
  }

  const error = euclideanDistance(reconstructed.embedding, actualState)
  return {
    error,
    withinBounds: error <= store.config.qualityThreshold,
  }
}

// ─── Compaction ─────────────────────────────────────────────────────────────

/** Compact old keyframes: merge multiple keyframe-delta pairs into fewer */
export function compact(
  store: KeyframeDeltaStore,
  keepLatestN: number = 3,
): KeyframeDeltaStore {
  if (store.keyframes.length <= keepLatestN) {
    return store
  }

  const toKeep = store.keyframes.slice(-keepLatestN)
  const toKeepIds = new Set(toKeep.map(kf => kf.id))

  const newSequences = new Map<string, DeltaSequence>()
  for (const [id, seq] of store.sequences) {
    if (toKeepIds.has(id)) {
      newSequences.set(id, seq)
    }
  }

  return {
    ...store,
    keyframes: toKeep,
    sequences: newSequences,
  }
}

/** Get storage size estimate (number of vectors stored) */
export function getStorageSize(store: KeyframeDeltaStore): {
  keyframeCount: number
  deltaCount: number
  totalVectors: number
} {
  let deltaCount = 0
  for (const seq of store.sequences.values()) {
    deltaCount += seq.deltas.length
  }

  return {
    keyframeCount: store.keyframes.length,
    deltaCount,
    totalVectors: store.keyframes.length + deltaCount,
  }
}
