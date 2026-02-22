/**
 * Relevance scoring types for context-towel.
 *
 * Defines the pluggable interface for scoring and ranking context items.
 * The default implementation uses simple heuristics (recency, reference count,
 * name similarity). Phase 2 will swap in @dm/physics-memory for vector-based
 * scoring.
 */

// ─── Primitives ────────────────────────────────────────────────────────────

/** A position in a file or document. */
export interface Position {
  line: number
  column: number
}

// ─── Context Items ─────────────────────────────────────────────────────────

/** The kinds of context items the relevance system can score. */
export type ContextItemType =
  | 'file'
  | 'function'
  | 'class'
  | 'variable'
  | 'memory'
  | 'conversation'
  | 'skill'

/** A context item that can be scored for relevance. */
export interface ContextItem {
  /** Unique identifier for this item. */
  id: string
  /** What kind of context this represents. */
  type: ContextItemType
  /** Human-readable name (filename, function name, etc.). */
  name: string
  /** File or resource path, if applicable. */
  path?: string
  /** Raw content of this item. */
  content?: string
  /** Position within a file, if applicable. */
  position?: Position
  /** Timestamp (ms since epoch) when this item was last accessed. */
  lastAccessed?: number
  /** How many times this item is referenced elsewhere. */
  referenceCount?: number
  /** Arbitrary tags for filtering/categorization. */
  tags?: string[]
  /** Extensible metadata bag. */
  metadata?: Record<string, unknown>
}

// ─── Scored Results ────────────────────────────────────────────────────────

/** A context item with its computed relevance score and explanation. */
export interface RankedContextItem {
  /** The original context item. */
  item: ContextItem
  /** Normalized relevance score in [0, 1]. Higher = more relevant. */
  score: number
  /** Human-readable reasons explaining how this score was derived. */
  reasons: string[]
}

// ─── Graph Context ─────────────────────────────────────────────────────────

/** A weighted edge between two context items. */
export interface GraphEdge {
  from: string
  to: string
  weight: number
  type: string
}

/** Graph-based context for relationship-aware scoring. */
export interface GraphContext {
  nodes: ContextItem[]
  edges: GraphEdge[]
}

// ─── Scoring Options ───────────────────────────────────────────────────────

/** Weight overrides for scoring dimensions. Each value is in [0, 1]. */
export interface ScoringWeights {
  /** Weight for recency-based scoring. Default 0.3. */
  recency?: number
  /** Weight for reference-count-based scoring. Default 0.3. */
  referenceCount?: number
  /** Weight for name-similarity scoring. Default 0.4. */
  nameSimilarity?: number
}

/** Options passed to scoring and ranking operations. */
export interface RelevanceScoringOptions {
  /** What the user is looking for (used for name similarity). */
  query?: string
  /** The file currently being edited (for proximity scoring). */
  currentFile?: string
  /** Recently accessed files (for recency boosting). */
  recentFiles?: string[]
  /** Maximum number of results to return from rank(). */
  maxResults?: number
  /** Override default scoring weights. */
  weights?: ScoringWeights
}

// ─── Provider Interface ────────────────────────────────────────────────────

/** The pluggable relevance scoring provider interface. */
export interface RelevanceScoringProvider {
  /** Score a single item for relevance. Returns a value in [0, 1]. */
  score(item: ContextItem, options: RelevanceScoringOptions): number

  /** Score and rank multiple items, returning top results sorted by score descending. */
  rank(items: ContextItem[], options: RelevanceScoringOptions): RankedContextItem[]

  /** Provider name for logging and debugging. */
  readonly name: string
}
