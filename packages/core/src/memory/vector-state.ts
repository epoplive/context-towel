/**
 * Vector State Representation -- Problem-Solving State as Vectors
 *
 * Extracted from Felix memory system. Defines how problem-solving state is
 * represented as vectors for similarity search and trajectory encoding.
 *
 * Core concepts:
 *   - EmbeddingVector: dense float vector
 *   - ProblemStateVector: position in problem space
 *   - StepDelta: movement between states
 *   - Trajectory: ordered sequence of deltas
 *   - Progress: measure of distance to solution
 */

// ─── Core Vector Types ───────────────────────────────────────────────────────

/** A dense vector (float array) for embedding space */
export type EmbeddingVector = Float32Array

/** Create a zero vector of given dimension */
export function zeroVector(dim: number): EmbeddingVector {
  return new Float32Array(dim)
}

/** Create a vector from a number array */
export function vectorFrom(values: number[]): EmbeddingVector {
  return new Float32Array(values)
}

/** Default embedding dimension (lightweight for local use) */
export const DEFAULT_EMBEDDING_DIM = 128

// ─── Problem State Vector ────────────────────────────────────────────────────

export interface ProblemStateVector {
  id: string
  timestamp: number
  embedding: EmbeddingVector
  archetypeId?: string
  layer?: string
  metadata: ProblemStateMetadata
}

export interface ProblemStateMetadata {
  description: string
  activeFiles: string[]
  activeFunctions: string[]
  errors: string[]
  hypotheses: string[]
  toolsCalled: string[]
  phase: 'research' | 'plan' | 'execute' | 'verify' | 'unknown'
}

// ─── Solution Estimate ───────────────────────────────────────────────────────

export interface SolutionEstimate {
  embedding: EmbeddingVector
  confidence: number
  metadata: SolutionMetadata
}

export interface SolutionMetadata {
  expectedFiles: string[]
  changeType: 'condition' | 'algorithm' | 'signature' | 'configuration' | 'integration' | 'unknown'
  expectedFileCount: { min: number; max: number }
  expectedToolCalls: { min: number; max: number }
  constraints: string[]
}

// ─── Step Delta ──────────────────────────────────────────────────────────────

export interface StepDelta {
  stepIndex: number
  timestamp: number
  delta: EmbeddingVector
  progress: number
  action: StepAction
  deviationFromPrediction: number
}

export interface StepAction {
  type: 'tool_call' | 'llm_response' | 'user_input' | 'steering' | 'follow_up'
  toolName?: string
  summary: string
  success: boolean
  durationMs: number
}

// ─── Trajectory ──────────────────────────────────────────────────────────────

export interface Trajectory {
  id: string
  sessionId: string
  startState: ProblemStateVector
  initialEstimate: SolutionEstimate
  deltas: StepDelta[]
  currentState: ProblemStateVector
  currentEstimate: SolutionEstimate
  resolved: boolean
  outcome?: TrajectoryOutcome
}

export interface TrajectoryOutcome {
  success: boolean
  totalToolCalls: number
  totalDurationMs: number
  archetypeMatchQuality: number
  totalDeviation: number
}

// ─── Progress Metric ─────────────────────────────────────────────────────────

export interface ProgressMetric {
  overall: number
  distance: number
  trend: number
  confidence: number
  stepsSinceProgress: number
  isStuck: boolean
}

// ─── Vector Operations ───────────────────────────────────────────────────────

/** Dot product of two vectors */
export function dot(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!
  }
  return sum
}

/** L2 norm (magnitude) of a vector */
export function norm(v: EmbeddingVector): number {
  return Math.sqrt(dot(v, v))
}

/** Cosine similarity between two vectors (-1 to 1) */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const normA = norm(a)
  const normB = norm(b)
  if (normA === 0 || normB === 0) return 0
  return dot(a, b) / (normA * normB)
}

/** Euclidean distance between two vectors */
export function euclideanDistance(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/** Add two vectors */
export function addVectors(a: EmbeddingVector, b: EmbeddingVector): EmbeddingVector {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  const result = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i]! + b[i]!
  }
  return result
}

/** Subtract vectors: a - b */
export function subtractVectors(a: EmbeddingVector, b: EmbeddingVector): EmbeddingVector {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  const result = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i]! - b[i]!
  }
  return result
}

/** Scale a vector by a scalar */
export function scaleVector(v: EmbeddingVector, scalar: number): EmbeddingVector {
  const result = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i]! * scalar
  }
  return result
}

/** Normalize a vector to unit length */
export function normalizeVector(v: EmbeddingVector): EmbeddingVector {
  const n = norm(v)
  if (n === 0) return new Float32Array(v.length)
  return scaleVector(v, 1 / n)
}

/** Average of multiple vectors */
export function averageVectors(vectors: EmbeddingVector[]): EmbeddingVector {
  if (vectors.length === 0) throw new Error('Cannot average zero vectors')
  const dim = vectors[0]!.length
  const result = new Float32Array(dim)
  for (const v of vectors) {
    if (v.length !== dim) throw new Error('All vectors must have same dimension')
    for (let i = 0; i < dim; i++) {
      result[i]! += v[i]!
    }
  }
  for (let i = 0; i < dim; i++) {
    result[i]! /= vectors.length
  }
  return result
}

// ─── Text Embedding ──────────────────────────────────────────────────────────

/**
 * Simple text-to-vector embedding using character n-gram hashing.
 *
 * Lightweight LOCAL embedding -- no external API calls.
 * For production, swap with a proper embedding model.
 *
 * Algorithm:
 * 1. Extract character n-grams (2-4) from the text
 * 2. Hash each n-gram to a bucket in the embedding vector
 * 3. Accumulate hashed values (bag-of-n-grams in hashed space)
 * 4. Normalize to unit length
 */
export function embedText(text: string, dim: number = DEFAULT_EMBEDDING_DIM): EmbeddingVector {
  const vector = new Float32Array(dim)
  const lower = text.toLowerCase()

  // Extract character n-grams of sizes 2, 3, 4
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= lower.length - n; i++) {
      const ngram = lower.slice(i, i + n)
      const hash = hashString(ngram)
      const bucket = Math.abs(hash) % dim
      vector[bucket]! += hash > 0 ? 1 : -1
    }
  }

  // Hash individual words for semantic coverage
  const words = lower.split(/\s+/).filter(w => w.length > 0)
  for (const word of words) {
    const hash = hashString(word)
    const bucket = Math.abs(hash) % dim
    vector[bucket]! += (hash > 0 ? 1 : -1) * 2
  }

  return normalizeVector(vector)
}

/** Simple string hash (DJB2 variant) */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return hash
}

// ─── State Builders ──────────────────────────────────────────────────────────

/** Build a ProblemStateVector from metadata */
export function buildProblemState(
  id: string,
  metadata: ProblemStateMetadata,
  options?: { archetypeId?: string; layer?: string; dim?: number },
): ProblemStateVector {
  const textParts = [
    metadata.description,
    ...metadata.activeFiles,
    ...metadata.activeFunctions,
    ...metadata.errors,
    ...metadata.hypotheses,
    metadata.phase,
  ]
  const text = textParts.join(' ')

  return {
    id,
    timestamp: Date.now(),
    embedding: embedText(text, options?.dim ?? DEFAULT_EMBEDDING_DIM),
    archetypeId: options?.archetypeId,
    layer: options?.layer,
    metadata,
  }
}

/** Build a SolutionEstimate from metadata */
export function buildSolutionEstimate(
  metadata: SolutionMetadata,
  confidence: number = 0.5,
  dim: number = DEFAULT_EMBEDDING_DIM,
): SolutionEstimate {
  const textParts = [
    ...metadata.expectedFiles,
    metadata.changeType,
    ...metadata.constraints,
  ]
  const text = textParts.join(' ')

  return {
    embedding: embedText(text, dim),
    confidence: Math.max(0, Math.min(1, confidence)),
    metadata,
  }
}

/** Build a StepDelta from two consecutive states */
export function buildStepDelta(
  prevState: ProblemStateVector,
  nextState: ProblemStateVector,
  solutionEstimate: SolutionEstimate,
  action: StepAction,
  stepIndex: number,
  predictedDelta?: EmbeddingVector,
): StepDelta {
  const delta = subtractVectors(nextState.embedding, prevState.embedding)

  const prevSim = cosineSimilarity(prevState.embedding, solutionEstimate.embedding)
  const nextSim = cosineSimilarity(nextState.embedding, solutionEstimate.embedding)
  const progress = nextSim - prevSim

  let deviation = 0
  if (predictedDelta) {
    deviation = euclideanDistance(delta, predictedDelta)
  }

  return {
    stepIndex,
    timestamp: nextState.timestamp,
    delta,
    progress,
    action,
    deviationFromPrediction: deviation,
  }
}

// ─── Progress Measurement ────────────────────────────────────────────────────

/** Measure current progress of a trajectory */
export function measureProgress(trajectory: Trajectory, recentWindow: number = 5): ProgressMetric {
  const distance = euclideanDistance(
    trajectory.currentState.embedding,
    trajectory.currentEstimate.embedding,
  )

  const similarity = cosineSimilarity(
    trajectory.currentState.embedding,
    trajectory.currentEstimate.embedding,
  )
  const overall = (similarity + 1) / 2

  const recentDeltas = trajectory.deltas.slice(-recentWindow)
  const trend = recentDeltas.length > 0
    ? recentDeltas.reduce((sum, d) => sum + d.progress, 0) / recentDeltas.length
    : 0

  let stepsSinceProgress = 0
  for (let i = trajectory.deltas.length - 1; i >= 0; i--) {
    if (trajectory.deltas[i]!.progress > 0) break
    stepsSinceProgress++
  }

  const isStuck = stepsSinceProgress >= 3 && trajectory.deltas.length >= 3

  return {
    overall,
    distance,
    trend,
    confidence: trajectory.currentEstimate.confidence,
    stepsSinceProgress,
    isStuck,
  }
}

// ─── Trajectory Builder ──────────────────────────────────────────────────────

/** Create a new empty trajectory */
export function createTrajectory(
  id: string,
  sessionId: string,
  startState: ProblemStateVector,
  initialEstimate: SolutionEstimate,
): Trajectory {
  return {
    id,
    sessionId,
    startState,
    initialEstimate,
    deltas: [],
    currentState: startState,
    currentEstimate: initialEstimate,
    resolved: false,
  }
}

/** Append a step to a trajectory (immutable -- returns new trajectory) */
export function appendStep(
  trajectory: Trajectory,
  nextState: ProblemStateVector,
  action: StepAction,
  options?: {
    updatedEstimate?: SolutionEstimate
    predictedDelta?: EmbeddingVector
  },
): Trajectory {
  const stepIndex = trajectory.deltas.length
  const delta = buildStepDelta(
    trajectory.currentState,
    nextState,
    trajectory.currentEstimate,
    action,
    stepIndex,
    options?.predictedDelta,
  )

  return {
    ...trajectory,
    deltas: [...trajectory.deltas, delta],
    currentState: nextState,
    currentEstimate: options?.updatedEstimate ?? trajectory.currentEstimate,
  }
}

/** Mark a trajectory as resolved */
export function resolveTrajectory(
  trajectory: Trajectory,
  success: boolean,
): Trajectory {
  const totalToolCalls = trajectory.deltas.filter(
    d => d.action.type === 'tool_call',
  ).length
  const totalDurationMs = trajectory.deltas.reduce(
    (sum, d) => sum + d.action.durationMs,
    0,
  )
  const totalDeviation = trajectory.deltas.reduce(
    (sum, d) => sum + d.deviationFromPrediction,
    0,
  )

  const avgDeviation = trajectory.deltas.length > 0
    ? totalDeviation / trajectory.deltas.length
    : 0
  const archetypeMatchQuality = Math.max(0, 1 - avgDeviation)

  return {
    ...trajectory,
    resolved: true,
    outcome: {
      success,
      totalToolCalls,
      totalDurationMs,
      archetypeMatchQuality,
      totalDeviation,
    },
  }
}
