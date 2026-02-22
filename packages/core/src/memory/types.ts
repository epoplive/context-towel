/**
 * Memory system types.
 *
 * These types mirror the MemoryPort contract from @dm/felix-runtime
 * so that the implementation is structurally compatible without requiring the
 * peer dependency at compile time.
 */

// ─── MemoryPort Types (locally defined, structurally compatible with @dm/felix-runtime) ──

export type MemoryEntryKind = 'conversation' | 'artifact' | 'note' | 'document'

export type MemoryEntry = {
  id: string
  kind: MemoryEntryKind
  content: string
  tags: string[]
  metadata?: Record<string, unknown>
  embedding?: number[]
  sessionId?: string
  createdAt: string
  updatedAt: string
}

export type MemorySearchQuery = {
  text?: string
  tags?: TagFilter
  kind?: MemoryEntryKind | MemoryEntryKind[]
  sessionId?: string
  limit?: number
  offset?: number
}

export type MemorySearchResult = {
  entry: MemoryEntry
  score: number
}

export type TagFilter = {
  all?: string[]
  any?: string[]
  none?: string[]
}

export interface MemoryPort {
  search(query: MemorySearchQuery): Promise<MemoryEntry[]>
  vectorSearch(embedding: number[], limit: number): Promise<MemorySearchResult[]>
  fullTextSearch(text: string, limit: number): Promise<MemoryEntry[]>
  getByTags(tags: TagFilter): Promise<MemoryEntry[]>
  create(entry: MemoryEntry): Promise<void>
  update(id: string, patch: Partial<Omit<MemoryEntry, 'id'>>): Promise<void>
  delete(id: string): Promise<void>
}

// ─── Memory Hook Types ───────────────────────────────────────────────────────

export interface MemoryHookContext {
  /** Arbitrary context data for hook consumers */
  metadata?: Record<string, unknown>
}

export interface MemoryHook {
  /** Unique identifier for this hook */
  id: string
  /** Custom tag type prefixes this hook understands */
  tagTypes?: Array<{ prefix: string; description: string }>
  /** Called after a memory entry is created */
  onMemoryCreate?(entry: MemoryHookEntry, ctx: MemoryHookContext): Promise<void>
  /** Called after a memory entry is updated */
  onMemoryUpdate?(entry: MemoryHookEntry, changes: Partial<MemoryHookEntry>, ctx: MemoryHookContext): Promise<void>
  /** Called when a conversation ends */
  onConversationEnd?(conversationId: string, summary: string, ctx: MemoryHookContext): Promise<void>
}

/** The entry shape passed to hooks (uses our internal representation) */
export interface MemoryHookEntry {
  id: string
  kind: string
  content: string
  tags: string[]
  metadata?: Record<string, unknown>
  sessionId?: string
  createdAt: string
  updatedAt: string
}
