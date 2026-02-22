import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryService, MemoryHookRegistry } from '../../../src/memory/memory-service'
import { InMemoryStorageAdapter } from '../../../src/memory/storage-adapter'
import type { MemoryEntry, MemoryHook } from '../../../src/memory/types'

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

describe('MemoryService', () => {
  let service: MemoryService
  let adapter: InMemoryStorageAdapter

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter()
    service = new MemoryService(adapter)
  })

  describe('create', () => {
    it('creates a memory entry', async () => {
      const entry = makeEntry({ id: 'e1' })
      await service.create(entry)
      const found = await service.get('e1')
      expect(found).toBeDefined()
      expect(found!.content).toBe('Test content')
    })
  })

  describe('get', () => {
    it('returns undefined for non-existent entry', async () => {
      const result = await service.get('nope')
      expect(result).toBeUndefined()
    })
  })

  describe('update', () => {
    it('updates an existing entry', async () => {
      await service.create(makeEntry({ id: 'e1', content: 'old' }))
      const updated = await service.update('e1', { content: 'new' })
      expect(updated).toBeDefined()
      expect(updated!.content).toBe('new')
    })

    it('returns undefined for non-existent entry', async () => {
      const result = await service.update('nope', { content: 'x' })
      expect(result).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('deletes an existing entry', async () => {
      await service.create(makeEntry({ id: 'e1' }))
      const deleted = await service.delete('e1')
      expect(deleted).toBe(true)
      expect(await service.get('e1')).toBeUndefined()
    })
  })

  describe('search', () => {
    it('searches by text', async () => {
      await service.create(makeEntry({ id: 'e1', content: 'hello world' }))
      await service.create(makeEntry({ id: 'e2', content: 'goodbye' }))
      const results = await service.search({ text: 'hello' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })

    it('searches by kind', async () => {
      await service.create(makeEntry({ id: 'e1', kind: 'note' }))
      await service.create(makeEntry({ id: 'e2', kind: 'artifact' }))
      const results = await service.search({ kind: 'note' })
      expect(results).toHaveLength(1)
    })

    it('searches by tags', async () => {
      await service.create(makeEntry({ id: 'e1', tags: ['a', 'b'] }))
      await service.create(makeEntry({ id: 'e2', tags: ['c'] }))
      const results = await service.search({ tags: { all: ['a'] } })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })
  })

  describe('vectorSearch', () => {
    it('finds entries by embedding similarity', async () => {
      await service.create(makeEntry({ id: 'e1', embedding: [1, 0, 0] }))
      await service.create(makeEntry({ id: 'e2', embedding: [0, 1, 0] }))
      const results = await service.vectorSearch([1, 0, 0], 10)
      expect(results).toHaveLength(2)
      expect(results[0]!.entry.id).toBe('e1')
    })
  })

  describe('fullTextSearch', () => {
    it('returns text-matching entries', async () => {
      await service.create(makeEntry({ id: 'e1', content: 'TypeScript patterns' }))
      await service.create(makeEntry({ id: 'e2', content: 'Java patterns' }))
      const results = await service.fullTextSearch('typescript', 10)
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })
  })

  describe('getByTags', () => {
    it('returns entries matching tag filter', async () => {
      await service.create(makeEntry({ id: 'e1', tags: ['x'] }))
      await service.create(makeEntry({ id: 'e2', tags: ['y'] }))
      const results = await service.getByTags({ all: ['x'] })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('e1')
    })
  })
})

describe('MemoryHookRegistry', () => {
  let registry: MemoryHookRegistry

  beforeEach(() => {
    registry = new MemoryHookRegistry()
  })

  it('registers and lists hooks', () => {
    const hook: MemoryHook = { id: 'h1' }
    registry.register(hook)
    expect(registry.listHooks()).toHaveLength(1)
    expect(registry.getHook('h1')).toBe(hook)
  })

  it('unregisters hooks', () => {
    registry.register({ id: 'h1' })
    registry.unregister('h1')
    expect(registry.listHooks()).toHaveLength(0)
  })

  it('fires create hooks', async () => {
    const onCreateSpy = vi.fn()
    registry.register({
      id: 'h1',
      onMemoryCreate: onCreateSpy,
    })

    await registry.fireCreate(
      { id: 'e1', kind: 'note', content: 'test', tags: [], createdAt: '', updatedAt: '' },
      {},
    )
    expect(onCreateSpy).toHaveBeenCalledOnce()
  })

  it('fires update hooks', async () => {
    const onUpdateSpy = vi.fn()
    registry.register({
      id: 'h1',
      onMemoryUpdate: onUpdateSpy,
    })

    await registry.fireUpdate(
      { id: 'e1', kind: 'note', content: 'test', tags: [], createdAt: '', updatedAt: '' },
      { content: 'new' },
      {},
    )
    expect(onUpdateSpy).toHaveBeenCalledOnce()
  })

  it('fires conversation end hooks', async () => {
    const onEndSpy = vi.fn()
    registry.register({
      id: 'h1',
      onConversationEnd: onEndSpy,
    })

    await registry.fireConversationEnd('conv-1', 'summary', {})
    expect(onEndSpy).toHaveBeenCalledWith('conv-1', 'summary', {})
  })

  it('continues when a hook throws', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onCreateSpy = vi.fn()

    registry.register({
      id: 'h1',
      onMemoryCreate: () => { throw new Error('boom') },
    })
    registry.register({
      id: 'h2',
      onMemoryCreate: onCreateSpy,
    })

    await registry.fireCreate(
      { id: 'e1', kind: 'note', content: 'test', tags: [], createdAt: '', updatedAt: '' },
      {},
    )
    expect(onCreateSpy).toHaveBeenCalledOnce()
    errSpy.mockRestore()
  })

  it('collects tag types across hooks', () => {
    registry.register({
      id: 'h1',
      tagTypes: [{ prefix: 'proj:', description: 'Project tag' }],
    })
    registry.register({
      id: 'h2',
      tagTypes: [{ prefix: 'env:', description: 'Environment tag' }],
    })

    const types = registry.getAllTagTypes()
    expect(types).toHaveLength(2)
    expect(types[0]!.hookId).toBe('h1')
    expect(types[1]!.hookId).toBe('h2')
  })
})
