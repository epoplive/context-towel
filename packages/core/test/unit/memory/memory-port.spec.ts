import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryPortAdapter } from '../../../src/memory/memory-port'
import { InMemoryStorageAdapter } from '../../../src/memory/storage-adapter'
import type { MemoryEntry, MemoryPort } from '../../../src/memory/types'

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

describe('MemoryPortAdapter', () => {
  let port: MemoryPort

  beforeEach(() => {
    port = new MemoryPortAdapter(new InMemoryStorageAdapter())
  })

  // ─── Contract: all MemoryPort methods ──────────────────────────────

  describe('create', () => {
    it('creates an entry', async () => {
      const entry = makeEntry({ id: 'e1' })
      await port.create(entry)
      const results = await port.search({ text: 'Test content' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })
  })

  describe('search', () => {
    it('searches by text', async () => {
      await port.create(makeEntry({ id: 'e1', content: 'alpha' }))
      await port.create(makeEntry({ id: 'e2', content: 'beta' }))
      const results = await port.search({ text: 'alpha' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })

    it('searches by kind', async () => {
      await port.create(makeEntry({ id: 'e1', kind: 'note' }))
      await port.create(makeEntry({ id: 'e2', kind: 'document' }))
      const results = await port.search({ kind: 'document' })
      expect(results).toHaveLength(1)
      expect(results[0]!.kind).toBe('document')
    })

    it('searches by sessionId', async () => {
      await port.create(makeEntry({ id: 'e1', sessionId: 's1' }))
      await port.create(makeEntry({ id: 'e2', sessionId: 's2' }))
      const results = await port.search({ sessionId: 's1' })
      expect(results).toHaveLength(1)
    })

    it('supports limit and offset', async () => {
      for (let i = 0; i < 10; i++) {
        await port.create(makeEntry({ id: `e${i}` }))
      }
      const results = await port.search({ limit: 3 })
      expect(results).toHaveLength(3)
    })
  })

  describe('vectorSearch', () => {
    it('returns entries with similarity scores', async () => {
      await port.create(makeEntry({ id: 'e1', embedding: [1, 0, 0] }))
      await port.create(makeEntry({ id: 'e2', embedding: [0, 1, 0] }))
      const results = await port.vectorSearch([1, 0, 0], 10)
      expect(results).toHaveLength(2)
      expect(results[0]!.entry.id).toBe('e1')
      expect(results[0]!.score).toBeGreaterThan(results[1]!.score)
    })
  })

  describe('fullTextSearch', () => {
    it('returns matching entries', async () => {
      await port.create(makeEntry({ id: 'e1', content: 'React components' }))
      await port.create(makeEntry({ id: 'e2', content: 'Vue components' }))
      const results = await port.fullTextSearch('react', 10)
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })
  })

  describe('getByTags', () => {
    it('returns entries matching tag filter', async () => {
      await port.create(makeEntry({ id: 'e1', tags: ['frontend'] }))
      await port.create(makeEntry({ id: 'e2', tags: ['backend'] }))
      const results = await port.getByTags({ all: ['frontend'] })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })

    it('supports any filter', async () => {
      await port.create(makeEntry({ id: 'e1', tags: ['a'] }))
      await port.create(makeEntry({ id: 'e2', tags: ['b'] }))
      await port.create(makeEntry({ id: 'e3', tags: ['c'] }))
      const results = await port.getByTags({ any: ['a', 'b'] })
      expect(results).toHaveLength(2)
    })

    it('supports none filter', async () => {
      await port.create(makeEntry({ id: 'e1', tags: ['bug'] }))
      await port.create(makeEntry({ id: 'e2', tags: ['feature'] }))
      const results = await port.getByTags({ none: ['bug'] })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e2')
    })
  })

  describe('update', () => {
    it('updates an existing entry', async () => {
      await port.create(makeEntry({ id: 'e1', content: 'old' }))
      await port.update('e1', { content: 'new' })
      const results = await port.search({ text: 'new' })
      expect(results).toHaveLength(1)
    })

    it('throws for non-existent entry', async () => {
      await expect(port.update('nope', { content: 'x' }))
        .rejects.toThrow('not found')
    })
  })

  describe('delete', () => {
    it('deletes an existing entry', async () => {
      await port.create(makeEntry({ id: 'e1' }))
      await port.delete('e1')
      const results = await port.search({})
      expect(results).toHaveLength(0)
    })

    it('throws for non-existent entry', async () => {
      await expect(port.delete('nope'))
        .rejects.toThrow('not found')
    })
  })

  // ─── Default adapter ──────────────────────────────────────────────

  it('works with default InMemoryStorageAdapter when none provided', async () => {
    const defaultPort = new MemoryPortAdapter()
    await defaultPort.create(makeEntry({ id: 'e1', content: 'hello' }))
    const results = await defaultPort.search({ text: 'hello' })
    expect(results).toHaveLength(1)
  })
})
