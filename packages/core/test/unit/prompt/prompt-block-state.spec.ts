import { describe, it, expect, beforeEach } from 'vitest'
import { PromptBlockStateManager } from '../../../src/prompt/prompt-block-state'

describe('PromptBlockStateManager', () => {
  let state: PromptBlockStateManager

  beforeEach(() => {
    state = new PromptBlockStateManager()
  })

  // ── loadBlock ──────────────────────────────────────────────────────────

  describe('loadBlock', () => {
    it('stores a block with default normal priority', () => {
      state.loadBlock('intro', 'Hello world')
      const blocks = state.getBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('intro')
      expect(blocks[0].content).toBe('Hello world')
      expect(blocks[0].priority).toBe('normal')
    })

    it('stores a block with explicit priority', () => {
      state.loadBlock('sys', 'System prompt', { priority: 'system' })
      const block = state.getBlock('sys')
      expect(block).toBeDefined()
      expect(block!.priority).toBe('system')
    })

    it('records addedAt as an ISO timestamp', () => {
      const before = new Date().toISOString()
      state.loadBlock('ts', 'content')
      const after = new Date().toISOString()
      const block = state.getBlock('ts')!
      expect(block.addedAt >= before).toBe(true)
      expect(block.addedAt <= after).toBe(true)
    })

    it('preserves original options on the block', () => {
      state.loadBlock('opts', 'content', { priority: 'high', deduplicate: true, maxTokens: 500 })
      const block = state.getBlock('opts')!
      expect(block.options).toEqual({ priority: 'high', deduplicate: true, maxTokens: 500 })
    })

    it('replaces an existing block with the same ID (decorator pattern)', () => {
      state.loadBlock('dup', 'first version', { priority: 'low' })
      state.loadBlock('dup', 'second version', { priority: 'high' })
      expect(state.size).toBe(1)
      const block = state.getBlock('dup')!
      expect(block.content).toBe('second version')
      expect(block.priority).toBe('high')
    })

    it('throws on empty id', () => {
      expect(() => state.loadBlock('', 'content')).toThrow('Block id must be a non-empty string')
    })

    it('throws on whitespace-only id', () => {
      expect(() => state.loadBlock('   ', 'content')).toThrow('Block id must be a non-empty string')
    })

    it('throws on empty content', () => {
      expect(() => state.loadBlock('id', '')).toThrow('content must be a non-empty string')
    })

    it('throws on whitespace-only content', () => {
      expect(() => state.loadBlock('id', '   ')).toThrow('content must be a non-empty string')
    })

    it('trims the id before storing', () => {
      state.loadBlock('  padded  ', 'content')
      expect(state.getBlock('padded')).toBeDefined()
    })
  })

  // ── clearBlock ─────────────────────────────────────────────────────────

  describe('clearBlock', () => {
    it('removes an existing block', () => {
      state.loadBlock('a', 'content')
      expect(state.size).toBe(1)
      state.clearBlock('a')
      expect(state.size).toBe(0)
      expect(state.getBlock('a')).toBeUndefined()
    })

    it('is a no-op for a non-existent block', () => {
      state.loadBlock('a', 'content')
      state.clearBlock('nonexistent')
      expect(state.size).toBe(1)
    })

    it('does not throw when clearing from an empty manager', () => {
      expect(() => state.clearBlock('anything')).not.toThrow()
    })
  })

  // ── refreshBlock ───────────────────────────────────────────────────────

  describe('refreshBlock', () => {
    it('updates content of an existing block', () => {
      state.loadBlock('r', 'old content', { priority: 'high' })
      state.refreshBlock('r', 'new content')
      const block = state.getBlock('r')!
      expect(block.content).toBe('new content')
    })

    it('preserves options when refreshing', () => {
      state.loadBlock('r', 'old', { priority: 'system', deduplicate: true })
      state.refreshBlock('r', 'new')
      const block = state.getBlock('r')!
      expect(block.priority).toBe('system')
      expect(block.options).toEqual({ priority: 'system', deduplicate: true })
    })

    it('updates the addedAt timestamp', () => {
      state.loadBlock('r', 'old')
      const original = state.getBlock('r')!.addedAt

      // Small delay to ensure different timestamp
      const refreshed = new Promise<void>((resolve) => {
        setTimeout(() => {
          state.refreshBlock('r', 'new')
          resolve()
        }, 5)
      })

      return refreshed.then(() => {
        const updated = state.getBlock('r')!.addedAt
        expect(updated >= original).toBe(true)
      })
    })

    it('is a no-op when block does not exist', () => {
      state.refreshBlock('nonexistent', 'content')
      expect(state.size).toBe(0)
    })

    it('throws on empty content for an existing block', () => {
      state.loadBlock('r', 'content')
      expect(() => state.refreshBlock('r', '')).toThrow('must be a non-empty string')
    })

    it('throws on whitespace-only content for an existing block', () => {
      state.loadBlock('r', 'content')
      expect(() => state.refreshBlock('r', '   ')).toThrow('must be a non-empty string')
    })
  })

  // ── getBlocks (ordering) ───────────────────────────────────────────────

  describe('getBlocks', () => {
    it('returns blocks sorted by priority: system > high > normal > low', () => {
      state.loadBlock('low', 'L', { priority: 'low' })
      state.loadBlock('normal', 'N', { priority: 'normal' })
      state.loadBlock('system', 'S', { priority: 'system' })
      state.loadBlock('high', 'H', { priority: 'high' })

      const ids = state.getBlocks().map((b) => b.id)
      expect(ids).toEqual(['system', 'high', 'normal', 'low'])
    })

    it('preserves insertion order within the same priority', () => {
      state.loadBlock('a', 'A')
      state.loadBlock('b', 'B')
      state.loadBlock('c', 'C')
      const ids = state.getBlocks().map((b) => b.id)
      expect(ids).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array when no blocks exist', () => {
      expect(state.getBlocks()).toEqual([])
    })

    it('returns a snapshot (mutations do not affect previously returned arrays)', () => {
      state.loadBlock('a', 'A')
      const first = state.getBlocks()
      state.loadBlock('b', 'B')
      const second = state.getBlocks()
      expect(first).toHaveLength(1)
      expect(second).toHaveLength(2)
    })
  })

  // ── getBlock ───────────────────────────────────────────────────────────

  describe('getBlock', () => {
    it('returns the block for a valid id', () => {
      state.loadBlock('x', 'X content')
      const block = state.getBlock('x')
      expect(block).toBeDefined()
      expect(block!.content).toBe('X content')
    })

    it('returns undefined for an unknown id', () => {
      expect(state.getBlock('unknown')).toBeUndefined()
    })
  })

  // ── size & clear ───────────────────────────────────────────────────────

  describe('size', () => {
    it('starts at 0', () => {
      expect(state.size).toBe(0)
    })

    it('increments when blocks are added', () => {
      state.loadBlock('a', 'A')
      state.loadBlock('b', 'B')
      expect(state.size).toBe(2)
    })

    it('does not double-count replaced blocks', () => {
      state.loadBlock('a', 'v1')
      state.loadBlock('a', 'v2')
      expect(state.size).toBe(1)
    })
  })

  describe('clear', () => {
    it('removes all blocks', () => {
      state.loadBlock('a', 'A')
      state.loadBlock('b', 'B')
      state.clear()
      expect(state.size).toBe(0)
      expect(state.getBlocks()).toEqual([])
    })
  })
})
