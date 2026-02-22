/**
 * StorageAdapter — abstraction over persistence backends.
 *
 * The memory system uses this interface internally instead of direct
 * MikroORM or SQL calls. Implementations can target in-memory, SQLite,
 * PostgreSQL, or any other backend.
 */

import type { MemoryEntry, TagFilter } from './types'

// ─── StorageAdapter Interface ────────────────────────────────────────────────

export interface StorageAdapter {
  /** Insert a new memory entry. Throws if id already exists. */
  insert(entry: MemoryEntry): Promise<void>

  /** Find a single entry by id. Returns undefined if not found. */
  findById(id: string): Promise<MemoryEntry | undefined>

  /** Update an existing entry. Returns the updated entry or undefined if not found. */
  update(id: string, patch: Partial<Omit<MemoryEntry, 'id'>>): Promise<MemoryEntry | undefined>

  /** Delete an entry by id. Returns true if deleted, false if not found. */
  delete(id: string): Promise<boolean>

  /** Search entries using filter criteria. */
  search(query: StorageSearchQuery): Promise<MemoryEntry[]>

  /**
   * Vector similarity search. Returns entries sorted by descending similarity.
   * The adapter is responsible for computing the similarity metric.
   */
  vectorSearch(embedding: number[], limit: number): Promise<Array<{ entry: MemoryEntry; score: number }>>

  /**
   * Full-text search over entry content.
   * Returns entries matching the text, sorted by relevance.
   */
  fullTextSearch(text: string, limit: number): Promise<MemoryEntry[]>

  /** Get entries matching a tag filter. */
  getByTags(filter: TagFilter): Promise<MemoryEntry[]>
}

export interface StorageSearchQuery {
  text?: string
  tags?: TagFilter
  kind?: string | string[]
  sessionId?: string
  limit?: number
  offset?: number
}

// ─── Tag Filtering Utilities ─────────────────────────────────────────────────

/**
 * Client-side tag filter matching.
 * Returns true if the given tags satisfy all filter criteria.
 */
export function matchesTags(tags: string[], filter: TagFilter): boolean {
  if (filter.all?.length) {
    if (!filter.all.every((t: string) => tags.includes(t))) return false
  }
  if (filter.any?.length) {
    if (!filter.any.some((t: string) => tags.includes(t))) return false
  }
  if (filter.none?.length) {
    if (filter.none.some((t: string) => tags.includes(t))) return false
  }
  return true
}

// ─── InMemoryStorageAdapter ──────────────────────────────────────────────────

/**
 * In-memory implementation of StorageAdapter.
 * Suitable for testing, development, and lightweight use cases.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private store: Map<string, MemoryEntry> = new Map()

  async insert(entry: MemoryEntry): Promise<void> {
    if (this.store.has(entry.id)) {
      throw new Error(`Memory entry with id '${entry.id}' already exists`)
    }
    this.store.set(entry.id, { ...entry })
  }

  async findById(id: string): Promise<MemoryEntry | undefined> {
    const entry = this.store.get(id)
    return entry ? { ...entry } : undefined
  }

  async update(id: string, patch: Partial<Omit<MemoryEntry, 'id'>>): Promise<MemoryEntry | undefined> {
    const existing = this.store.get(id)
    if (!existing) return undefined

    const updated: MemoryEntry = {
      ...existing,
      ...patch,
      id: existing.id, // id is immutable
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    }
    this.store.set(id, updated)
    return { ...updated }
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }

  async search(query: StorageSearchQuery): Promise<MemoryEntry[]> {
    let results = Array.from(this.store.values())

    // Filter by kind
    if (query.kind) {
      const kinds = Array.isArray(query.kind) ? query.kind : [query.kind]
      results = results.filter(e => kinds.includes(e.kind))
    }

    // Filter by sessionId
    if (query.sessionId) {
      results = results.filter(e => e.sessionId === query.sessionId)
    }

    // Filter by tags
    if (query.tags) {
      const tagFilter = query.tags
      results = results.filter(e => matchesTags(e.tags, tagFilter))
    }

    // Filter by text (simple case-insensitive substring match)
    if (query.text) {
      const lower = query.text.toLowerCase()
      results = results.filter(e => e.content.toLowerCase().includes(lower))
    }

    // Sort by createdAt descending (most recent first)
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    // Apply offset and limit
    const offset = query.offset ?? 0
    const limit = query.limit ?? 20
    return results.slice(offset, offset + limit).map(e => ({ ...e }))
  }

  async vectorSearch(embedding: number[], limit: number): Promise<Array<{ entry: MemoryEntry; score: number }>> {
    const results: Array<{ entry: MemoryEntry; score: number }> = []

    for (const entry of this.store.values()) {
      if (!entry.embedding || entry.embedding.length === 0) continue
      if (entry.embedding.length !== embedding.length) continue

      const score = cosineSimilarity(embedding, entry.embedding)
      results.push({ entry: { ...entry }, score })
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  async fullTextSearch(text: string, limit: number): Promise<MemoryEntry[]> {
    const lower = text.toLowerCase()
    const results: Array<{ entry: MemoryEntry; score: number }> = []

    for (const entry of this.store.values()) {
      const content = entry.content.toLowerCase()
      if (content.includes(lower)) {
        // Simple relevance: shorter content with the match = more relevant
        const score = lower.length / content.length
        results.push({ entry: { ...entry }, score })
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit).map(r => r.entry)
  }

  async getByTags(filter: TagFilter): Promise<MemoryEntry[]> {
    const results = Array.from(this.store.values())
      .filter(e => matchesTags(e.tags, filter))
      .map(e => ({ ...e }))

    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return results
  }

  /** Utility: get current size of the store */
  get size(): number {
    return this.store.size
  }

  /** Utility: clear all entries */
  clear(): void {
    this.store.clear()
  }
}

// ─── Vector Math Utilities ───────────────────────────────────────────────────

function dotProduct(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!
  }
  return sum
}

function magnitude(v: number[]): number {
  return Math.sqrt(dotProduct(v, v))
}

/**
 * Cosine similarity between two vectors. Returns value in [-1, 1].
 * Returns 0 if either vector has zero magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a)
  const magB = magnitude(b)
  if (magA === 0 || magB === 0) return 0
  return dotProduct(a, b) / (magA * magB)
}
