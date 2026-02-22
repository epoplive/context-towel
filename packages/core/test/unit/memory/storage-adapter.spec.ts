import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryStorageAdapter,
  matchesTags,
  cosineSimilarity,
} from '../../../src/memory/storage-adapter'
import type { MemoryEntry } from '../../../src/memory/types'

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? `entry-${Math.random().toString(36).slice(2)}`,
    kind: overrides.kind ?? 'note',
    content: overrides.content ?? 'Test content',
    tags: overrides.tags ?? [],
    metadata: overrides.metadata,
    embedding: overrides.embedding,
    sessionId: overrides.sessionId,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

describe('InMemoryStorageAdapter', () => {
  let adapter: InMemoryStorageAdapter

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter()
  })

  // ─── CRUD ──────────────────────────────────────────────────────────

  describe('insert', () => {
    it('inserts an entry', async () => {
      const entry = makeEntry({ id: 'e1' })
      await adapter.insert(entry)
      expect(adapter.size).toBe(1)
    })

    it('throws on duplicate id', async () => {
      const entry = makeEntry({ id: 'dup' })
      await adapter.insert(entry)
      await expect(adapter.insert(entry)).rejects.toThrow("already exists")
    })
  })

  describe('findById', () => {
    it('returns undefined for non-existent id', async () => {
      const result = await adapter.findById('nope')
      expect(result).toBeUndefined()
    })

    it('returns a copy of the entry', async () => {
      const entry = makeEntry({ id: 'e1', content: 'original' })
      await adapter.insert(entry)
      const found = await adapter.findById('e1')
      expect(found).toBeDefined()
      expect(found!.content).toBe('original')
      // Should be a copy, not the same reference
      found!.content = 'mutated'
      const found2 = await adapter.findById('e1')
      expect(found2!.content).toBe('original')
    })
  })

  describe('update', () => {
    it('returns undefined for non-existent id', async () => {
      const result = await adapter.update('nope', { content: 'x' })
      expect(result).toBeUndefined()
    })

    it('updates specified fields', async () => {
      await adapter.insert(makeEntry({ id: 'e1', content: 'old', tags: ['a'] }))
      const updated = await adapter.update('e1', { content: 'new' })
      expect(updated).toBeDefined()
      expect(updated!.content).toBe('new')
      expect(updated!.tags).toEqual(['a']) // unchanged
    })

    it('does not change the id', async () => {
      await adapter.insert(makeEntry({ id: 'e1' }))
      const updated = await adapter.update('e1', { content: 'new' })
      expect(updated!.id).toBe('e1')
    })

    it('sets updatedAt', async () => {
      await adapter.insert(makeEntry({ id: 'e1', updatedAt: '2020-01-01T00:00:00Z' }))
      const updated = await adapter.update('e1', { content: 'new' })
      expect(updated!.updatedAt).not.toBe('2020-01-01T00:00:00Z')
    })
  })

  describe('delete', () => {
    it('returns false for non-existent id', async () => {
      expect(await adapter.delete('nope')).toBe(false)
    })

    it('deletes an existing entry', async () => {
      await adapter.insert(makeEntry({ id: 'e1' }))
      expect(await adapter.delete('e1')).toBe(true)
      expect(adapter.size).toBe(0)
      expect(await adapter.findById('e1')).toBeUndefined()
    })
  })

  // ─── Search ────────────────────────────────────────────────────────

  describe('search', () => {
    it('returns all entries with empty query', async () => {
      await adapter.insert(makeEntry({ id: 'e1' }))
      await adapter.insert(makeEntry({ id: 'e2' }))
      const results = await adapter.search({})
      expect(results).toHaveLength(2)
    })

    it('filters by kind', async () => {
      await adapter.insert(makeEntry({ id: 'e1', kind: 'note' }))
      await adapter.insert(makeEntry({ id: 'e2', kind: 'conversation' }))
      const results = await adapter.search({ kind: 'note' })
      expect(results).toHaveLength(1)
      expect(results[0]!.kind).toBe('note')
    })

    it('filters by kind array', async () => {
      await adapter.insert(makeEntry({ id: 'e1', kind: 'note' }))
      await adapter.insert(makeEntry({ id: 'e2', kind: 'conversation' }))
      await adapter.insert(makeEntry({ id: 'e3', kind: 'artifact' }))
      const results = await adapter.search({ kind: ['note', 'artifact'] })
      expect(results).toHaveLength(2)
    })

    it('filters by sessionId', async () => {
      await adapter.insert(makeEntry({ id: 'e1', sessionId: 's1' }))
      await adapter.insert(makeEntry({ id: 'e2', sessionId: 's2' }))
      const results = await adapter.search({ sessionId: 's1' })
      expect(results).toHaveLength(1)
      expect(results[0]!.sessionId).toBe('s1')
    })

    it('filters by text (case-insensitive)', async () => {
      await adapter.insert(makeEntry({ id: 'e1', content: 'Hello World' }))
      await adapter.insert(makeEntry({ id: 'e2', content: 'Goodbye' }))
      const results = await adapter.search({ text: 'hello' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })

    it('applies limit and offset', async () => {
      for (let i = 0; i < 10; i++) {
        await adapter.insert(makeEntry({
          id: `e${i}`,
          createdAt: new Date(2025, 0, 10 - i).toISOString(),
        }))
      }
      const results = await adapter.search({ limit: 3, offset: 2 })
      expect(results).toHaveLength(3)
    })
  })

  // ─── Tag Filtering ─────────────────────────────────────────────────

  describe('tag filtering in search', () => {
    beforeEach(async () => {
      await adapter.insert(makeEntry({ id: 'e1', tags: ['bug', 'frontend', 'urgent'] }))
      await adapter.insert(makeEntry({ id: 'e2', tags: ['feature', 'backend'] }))
      await adapter.insert(makeEntry({ id: 'e3', tags: ['bug', 'backend'] }))
    })

    it('filters by tags.all', async () => {
      const results = await adapter.search({ tags: { all: ['bug', 'frontend'] } })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })

    it('filters by tags.any', async () => {
      const results = await adapter.search({ tags: { any: ['frontend', 'backend'] } })
      expect(results).toHaveLength(3)
    })

    it('filters by tags.none', async () => {
      const results = await adapter.search({ tags: { none: ['bug'] } })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e2')
    })

    it('combines all/none filters', async () => {
      const results = await adapter.search({
        tags: { all: ['bug'], none: ['frontend'] },
      })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e3')
    })
  })

  // ─── Vector Search ─────────────────────────────────────────────────

  describe('vectorSearch', () => {
    it('returns entries sorted by similarity', async () => {
      await adapter.insert(makeEntry({ id: 'e1', embedding: [1, 0, 0] }))
      await adapter.insert(makeEntry({ id: 'e2', embedding: [0, 1, 0] }))
      await adapter.insert(makeEntry({ id: 'e3', embedding: [0.9, 0.1, 0] }))

      const results = await adapter.vectorSearch([1, 0, 0], 10)
      expect(results).toHaveLength(3)
      expect(results[0]!.entry.id).toBe('e1')
      expect(results[0]!.score).toBeCloseTo(1.0, 4)
    })

    it('skips entries without embeddings', async () => {
      await adapter.insert(makeEntry({ id: 'e1', embedding: [1, 0, 0] }))
      await adapter.insert(makeEntry({ id: 'e2' })) // no embedding
      const results = await adapter.vectorSearch([1, 0, 0], 10)
      expect(results).toHaveLength(1)
    })

    it('limits results', async () => {
      for (let i = 0; i < 10; i++) {
        await adapter.insert(makeEntry({ id: `e${i}`, embedding: [Math.random(), Math.random(), Math.random()] }))
      }
      const results = await adapter.vectorSearch([1, 0, 0], 3)
      expect(results).toHaveLength(3)
    })
  })

  // ─── Full-Text Search ──────────────────────────────────────────────

  describe('fullTextSearch', () => {
    it('returns matching entries', async () => {
      await adapter.insert(makeEntry({ id: 'e1', content: 'The quick brown fox' }))
      await adapter.insert(makeEntry({ id: 'e2', content: 'The lazy dog' }))
      const results = await adapter.fullTextSearch('fox', 10)
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })

    it('is case-insensitive', async () => {
      await adapter.insert(makeEntry({ id: 'e1', content: 'TypeScript Compiler' }))
      const results = await adapter.fullTextSearch('typescript', 10)
      expect(results).toHaveLength(1)
    })

    it('limits results', async () => {
      for (let i = 0; i < 10; i++) {
        await adapter.insert(makeEntry({ id: `e${i}`, content: `item ${i} match` }))
      }
      const results = await adapter.fullTextSearch('match', 3)
      expect(results).toHaveLength(3)
    })
  })

  // ─── getByTags ─────────────────────────────────────────────────────

  describe('getByTags', () => {
    it('returns entries matching tag filter', async () => {
      await adapter.insert(makeEntry({ id: 'e1', tags: ['a', 'b'] }))
      await adapter.insert(makeEntry({ id: 'e2', tags: ['b', 'c'] }))
      await adapter.insert(makeEntry({ id: 'e3', tags: ['d'] }))

      const results = await adapter.getByTags({ any: ['a', 'c'] })
      expect(results).toHaveLength(2)
    })
  })

  // ─── Utility ───────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all entries', async () => {
      await adapter.insert(makeEntry({ id: 'e1' }))
      await adapter.insert(makeEntry({ id: 'e2' }))
      adapter.clear()
      expect(adapter.size).toBe(0)
    })
  })
})

// ─── matchesTags ─────────────────────────────────────────────────────

describe('matchesTags', () => {
  it('returns true for empty filter', () => {
    expect(matchesTags(['a', 'b'], {})).toBe(true)
  })

  it('all: requires all tags present', () => {
    expect(matchesTags(['a', 'b', 'c'], { all: ['a', 'b'] })).toBe(true)
    expect(matchesTags(['a'], { all: ['a', 'b'] })).toBe(false)
  })

  it('any: requires at least one tag present', () => {
    expect(matchesTags(['a'], { any: ['a', 'b'] })).toBe(true)
    expect(matchesTags(['c'], { any: ['a', 'b'] })).toBe(false)
  })

  it('none: requires no tags present', () => {
    expect(matchesTags(['c'], { none: ['a', 'b'] })).toBe(true)
    expect(matchesTags(['a', 'c'], { none: ['a', 'b'] })).toBe(false)
  })

  it('combines filters', () => {
    expect(matchesTags(['a', 'c'], { all: ['a'], none: ['b'] })).toBe(true)
    expect(matchesTags(['a', 'b'], { all: ['a'], none: ['b'] })).toBe(false)
  })
})

// ─── cosineSimilarity ────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1.0)
  })

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 0, 0])).toBe(0)
  })
})
