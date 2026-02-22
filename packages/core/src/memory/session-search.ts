/**
 * Cross-Session Search -- Trajectory-Based Similarity Search
 *
 * Provides trajectory embedding, similar-problem search, strategy transfer,
 * and cross-session knowledge retrieval.
 *
 * This module defines the interface and in-memory implementation.
 * Database adapters (e.g. pgvector) can be swapped in via StorageAdapter.
 *
 * Key concepts:
 *   - SessionRecord: a completed trajectory with its embedding
 *   - VectorIndex: stores embeddings and supports similarity search
 *   - Strategy transfer: "last time we saw this pattern, these steps worked"
 *   - Knowledge retrieval: "what do we know about auth in this project?"
 */

import {
  type EmbeddingVector,
  type Trajectory,
  type TrajectoryOutcome,
  DEFAULT_EMBEDDING_DIM,
  embedText,
  cosineSimilarity,
  euclideanDistance,
} from './vector-state'

// ─── Session Record ─────────────────────────────────────────────────────────

/** A completed session record with its embedding */
export interface SessionRecord {
  id: string
  projectId: string
  description: string
  archetypeId: string
  layer: string
  technique: string
  embedding: EmbeddingVector
  outcome: TrajectoryOutcome
  modifiedFiles: string[]
  toolsUsed: string[]
  timestamp: number
  strategySummary: string
  tags: string[]
}

/** Search result with similarity score */
export interface SearchResult {
  record: SessionRecord
  score: number
}

/** Search options */
export interface SearchOptions {
  maxResults?: number
  minScore?: number
  projectId?: string
  archetypeId?: string
  layer?: string
  technique?: string
  tags?: string[]
  onlySuccessful?: boolean
  metric?: 'cosine' | 'euclidean'
}

/** Strategy transfer result */
export interface StrategyTransfer {
  sourceSession: SessionRecord
  similarity: number
  strategy: string
  recommendedTools: string[]
  relevantFiles: string[]
  confidence: number
}

/** Knowledge retrieval result */
export interface KnowledgeResult {
  topic: string
  sessions: SessionRecord[]
  commonPatterns: string[]
  commonTools: string[]
  commonFiles: string[]
  successRate: number
}

// ─── Vector Index Interface ─────────────────────────────────────────────────

/** Interface for vector index storage (in-memory or database-backed) */
export interface VectorIndex {
  insert(record: SessionRecord): Promise<void>
  search(query: EmbeddingVector, options?: SearchOptions): Promise<SearchResult[]>
  get(id: string): Promise<SessionRecord | undefined>
  delete(id: string): Promise<boolean>
  getAll(options?: { projectId?: string }): Promise<SessionRecord[]>
  count(options?: { projectId?: string }): Promise<number>
}

// ─── In-Memory Vector Index ─────────────────────────────────────────────────

/** In-memory implementation of VectorIndex (for testing and small datasets) */
export class InMemoryVectorIndex implements VectorIndex {
  private records: Map<string, SessionRecord> = new Map()

  async insert(record: SessionRecord): Promise<void> {
    this.records.set(record.id, record)
  }

  async search(query: EmbeddingVector, options?: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options?.maxResults ?? 5
    const minScore = options?.minScore ?? 0.1
    const metric = options?.metric ?? 'cosine'

    const results: SearchResult[] = []

    for (const record of this.records.values()) {
      if (options?.projectId && record.projectId !== options.projectId) continue
      if (options?.archetypeId && record.archetypeId !== options.archetypeId) continue
      if (options?.layer && record.layer !== options.layer) continue
      if (options?.technique && record.technique !== options.technique) continue
      if (options?.onlySuccessful && !record.outcome.success) continue
      if (options?.tags && options.tags.length > 0) {
        const hasTag = options.tags.some(t => record.tags.includes(t))
        if (!hasTag) continue
      }

      let score: number
      if (metric === 'cosine') {
        score = cosineSimilarity(query, record.embedding)
        score = (score + 1) / 2
      } else {
        const dist = euclideanDistance(query, record.embedding)
        score = 1 / (1 + dist)
      }

      if (score >= minScore) {
        results.push({ record, score })
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, maxResults)
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    return this.records.get(id)
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id)
  }

  async getAll(options?: { projectId?: string }): Promise<SessionRecord[]> {
    const all = Array.from(this.records.values())
    if (options?.projectId) {
      return all.filter(r => r.projectId === options.projectId)
    }
    return all
  }

  async count(options?: { projectId?: string }): Promise<number> {
    if (options?.projectId) {
      let count = 0
      for (const r of this.records.values()) {
        if (r.projectId === options.projectId) count++
      }
      return count
    }
    return this.records.size
  }
}

// ─── Session Record Builder ─────────────────────────────────────────────────

/** Build a SessionRecord from a resolved trajectory */
export function buildSessionRecord(
  trajectory: Trajectory,
  metadata: {
    projectId: string
    archetypeId: string
    layer: string
    technique: string
    modifiedFiles: string[]
    strategySummary: string
    tags: string[]
  },
  dim: number = DEFAULT_EMBEDDING_DIM,
): SessionRecord {
  const textParts = [
    trajectory.startState.metadata.description,
    metadata.archetypeId,
    metadata.layer,
    metadata.technique,
    ...metadata.modifiedFiles,
    ...metadata.tags,
  ]
  const embedding = embedText(textParts.join(' '), dim)

  const toolsUsed = [...new Set(
    trajectory.deltas
      .filter(d => d.action.toolName)
      .map(d => d.action.toolName!),
  )]

  return {
    id: trajectory.id,
    projectId: metadata.projectId,
    description: trajectory.startState.metadata.description,
    archetypeId: metadata.archetypeId,
    layer: metadata.layer,
    technique: metadata.technique,
    embedding,
    outcome: trajectory.outcome ?? {
      success: false,
      totalToolCalls: 0,
      totalDurationMs: 0,
      archetypeMatchQuality: 0,
      totalDeviation: 0,
    },
    modifiedFiles: metadata.modifiedFiles,
    toolsUsed,
    timestamp: Date.now(),
    strategySummary: metadata.strategySummary,
    tags: metadata.tags,
  }
}

// ─── Similar Problem Search ─────────────────────────────────────────────────

/** Find sessions similar to a new problem */
export async function findSimilarProblems(
  index: VectorIndex,
  problemDescription: string,
  options?: SearchOptions & { dim?: number },
): Promise<SearchResult[]> {
  const dim = options?.dim ?? DEFAULT_EMBEDDING_DIM
  const queryEmbedding = embedText(problemDescription, dim)
  return index.search(queryEmbedding, options)
}

/** Find sessions similar to a trajectory's starting state */
export async function findSimilarTrajectories(
  index: VectorIndex,
  trajectory: Trajectory,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  return index.search(trajectory.startState.embedding, options)
}

// ─── Strategy Transfer ──────────────────────────────────────────────────────

/** Transfer strategy from similar past sessions */
export async function transferStrategy(
  index: VectorIndex,
  problemDescription: string,
  options?: SearchOptions & { dim?: number },
): Promise<StrategyTransfer[]> {
  const results = await findSimilarProblems(index, problemDescription, {
    ...options,
    onlySuccessful: true,
    maxResults: options?.maxResults ?? 3,
  })

  return results.map(result => ({
    sourceSession: result.record,
    similarity: result.score,
    strategy: result.record.strategySummary,
    recommendedTools: result.record.toolsUsed,
    relevantFiles: result.record.modifiedFiles,
    confidence: result.score * (result.record.outcome.archetypeMatchQuality || 0.5),
  }))
}

// ─── Knowledge Retrieval ────────────────────────────────────────────────────

/** Retrieve aggregated knowledge about a topic */
export async function retrieveKnowledge(
  index: VectorIndex,
  topic: string,
  options?: { projectId?: string; dim?: number; maxSessions?: number },
): Promise<KnowledgeResult> {
  const dim = options?.dim ?? DEFAULT_EMBEDDING_DIM
  const maxSessions = options?.maxSessions ?? 10

  const queryEmbedding = embedText(topic, dim)
  const results = await index.search(queryEmbedding, {
    maxResults: maxSessions,
    minScore: 0.2,
    projectId: options?.projectId,
  })

  const sessions = results.map(r => r.record)

  const archetypeCounts = new Map<string, number>()
  const toolCounts = new Map<string, number>()
  const fileCounts = new Map<string, number>()

  for (const session of sessions) {
    archetypeCounts.set(
      session.archetypeId,
      (archetypeCounts.get(session.archetypeId) ?? 0) + 1,
    )
    for (const tool of session.toolsUsed) {
      toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1)
    }
    for (const file of session.modifiedFiles) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1)
    }
  }

  const commonPatterns = Array.from(archetypeCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  const commonTools = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool]) => tool)

  const commonFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file]) => file)

  const successCount = sessions.filter(s => s.outcome.success).length
  const successRate = sessions.length > 0 ? successCount / sessions.length : 0

  return {
    topic,
    sessions,
    commonPatterns,
    commonTools,
    commonFiles,
    successRate,
  }
}
