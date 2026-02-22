import { describe, it, expect, beforeEach } from 'vitest'
import { PromptManager } from '../../../src/prompt/prompt-port'
import type { PromptManagementPort, PromptBlock } from '../../../src/prompt/types'

describe('PromptManager (PromptManagementPort implementation)', () => {
  let manager: PromptManager

  beforeEach(() => {
    manager = new PromptManager()
  })

  // ── Interface conformance ──────────────────────────────────────────────

  it('satisfies the PromptManagementPort interface', () => {
    // Compile-time check: assign PromptManager to PromptManagementPort variable
    const port: PromptManagementPort = manager
    expect(typeof port.loadBlock).toBe('function')
    expect(typeof port.clearBlock).toBe('function')
    expect(typeof port.refreshBlock).toBe('function')
    expect(typeof port.getBlocks).toBe('function')
    expect(typeof port.assembleSystemPrompt).toBe('function')
  })

  // ── Full lifecycle ─────────────────────────────────────────────────────

  describe('load / clear / refresh lifecycle', () => {
    it('loads a block and retrieves it', () => {
      manager.loadBlock('identity', 'You are a helpful assistant.', { priority: 'system' })
      const blocks = manager.getBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('identity')
      expect(blocks[0].content).toBe('You are a helpful assistant.')
      expect(blocks[0].priority).toBe('system')
    })

    it('clears a block', () => {
      manager.loadBlock('temp', 'temporary content')
      expect(manager.blockCount).toBe(1)
      manager.clearBlock('temp')
      expect(manager.blockCount).toBe(0)
    })

    it('refreshes a block content without changing priority', () => {
      manager.loadBlock('ctx', 'old context', { priority: 'high' })
      manager.refreshBlock('ctx', 'new context')
      const block = manager.getBlock('ctx')!
      expect(block.content).toBe('new context')
      expect(block.priority).toBe('high')
    })

    it('full cycle: load, refresh, assemble, clear, assemble', () => {
      manager.loadBlock('a', 'block A', { priority: 'system' })
      manager.loadBlock('b', 'block B', { priority: 'low' })

      expect(manager.assembleSystemPrompt()).toBe('block A\n\nblock B')

      manager.refreshBlock('a', 'block A updated')
      expect(manager.assembleSystemPrompt()).toBe('block A updated\n\nblock B')

      manager.clearBlock('b')
      expect(manager.assembleSystemPrompt()).toBe('block A updated')

      manager.clearAll()
      expect(manager.assembleSystemPrompt()).toBe('')
    })
  })

  // ── assembleSystemPrompt ───────────────────────────────────────────────

  describe('assembleSystemPrompt', () => {
    it('returns empty string when no blocks exist', () => {
      expect(manager.assembleSystemPrompt()).toBe('')
    })

    it('assembles blocks in priority order', () => {
      manager.loadBlock('rules', 'Follow the rules.', { priority: 'normal' })
      manager.loadBlock('identity', 'You are a bot.', { priority: 'system' })
      manager.loadBlock('tools', 'Use these tools.', { priority: 'high' })
      manager.loadBlock('footer', 'End of prompt.', { priority: 'low' })

      const prompt = manager.assembleSystemPrompt()
      const parts = prompt.split('\n\n')
      expect(parts).toEqual([
        'You are a bot.',
        'Use these tools.',
        'Follow the rules.',
        'End of prompt.',
      ])
    })

    it('handles single block', () => {
      manager.loadBlock('solo', 'Only block.')
      expect(manager.assembleSystemPrompt()).toBe('Only block.')
    })
  })

  // ── Decorator / replacement behavior ───────────────────────────────────

  describe('decorator / replacement behavior', () => {
    it('replacing a block does not duplicate content in assembly', () => {
      manager.loadBlock('ctx', 'version 1')
      manager.loadBlock('ctx', 'version 2')
      expect(manager.blockCount).toBe(1)
      expect(manager.assembleSystemPrompt()).toBe('version 2')
    })

    it('replacing a block updates priority if new options differ', () => {
      manager.loadBlock('a', 'content', { priority: 'low' })
      manager.loadBlock('a', 'content updated', { priority: 'system' })
      expect(manager.getBlock('a')!.priority).toBe('system')
    })

    it('replacing a block with different content keeps block count at 1', () => {
      manager.loadBlock('x', 'first')
      manager.loadBlock('x', 'second')
      manager.loadBlock('x', 'third')
      expect(manager.blockCount).toBe(1)
      expect(manager.getBlock('x')!.content).toBe('third')
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('getBlocks returns array snapshot not affected by later mutations', () => {
      manager.loadBlock('a', 'A')
      const snapshot = manager.getBlocks()
      manager.loadBlock('b', 'B')
      expect(snapshot).toHaveLength(1)
      expect(manager.getBlocks()).toHaveLength(2)
    })

    it('clearBlock on nonexistent id is a no-op', () => {
      manager.loadBlock('a', 'A')
      manager.clearBlock('zzz')
      expect(manager.blockCount).toBe(1)
    })

    it('refreshBlock on nonexistent id is a no-op', () => {
      manager.refreshBlock('ghost', 'new content')
      expect(manager.blockCount).toBe(0)
    })

    it('clearAll empties everything', () => {
      manager.loadBlock('a', 'A')
      manager.loadBlock('b', 'B')
      manager.loadBlock('c', 'C')
      manager.clearAll()
      expect(manager.blockCount).toBe(0)
      expect(manager.getBlocks()).toEqual([])
      expect(manager.assembleSystemPrompt()).toBe('')
    })

    it('loadBlock throws on empty id', () => {
      expect(() => manager.loadBlock('', 'content')).toThrow()
    })

    it('loadBlock throws on empty content', () => {
      expect(() => manager.loadBlock('id', '')).toThrow()
    })

    it('blocks returned by getBlocks have correct PromptBlock shape', () => {
      manager.loadBlock('shaped', 'content', { priority: 'high', maxTokens: 100 })
      const block: PromptBlock = manager.getBlocks()[0]
      expect(block).toHaveProperty('id', 'shaped')
      expect(block).toHaveProperty('content', 'content')
      expect(block).toHaveProperty('priority', 'high')
      expect(block).toHaveProperty('addedAt')
      expect(typeof block.addedAt).toBe('string')
      expect(block).toHaveProperty('options')
      expect(block.options).toEqual({ priority: 'high', maxTokens: 100 })
    })

    it('handles many blocks across all priority levels', () => {
      const priorities = ['system', 'high', 'normal', 'low'] as const
      for (let i = 0; i < 100; i++) {
        const priority = priorities[i % 4]
        manager.loadBlock(`block-${i}`, `Content ${i}`, { priority })
      }
      expect(manager.blockCount).toBe(100)

      const blocks = manager.getBlocks()
      // Verify priority ordering is correct
      let lastWeight = -1
      const weightMap = { system: 0, high: 1, normal: 2, low: 3 }
      for (const block of blocks) {
        const weight = weightMap[block.priority]
        expect(weight >= lastWeight).toBe(true)
        if (weight > lastWeight) lastWeight = weight
      }
    })
  })

  // ── Deduplication via assembleSystemPrompt ─────────────────────────────

  describe('deduplication through assembly', () => {
    it('deduplicate blocks suppress identical content', () => {
      manager.loadBlock('a', 'shared', { deduplicate: true })
      manager.loadBlock('b', 'shared', { deduplicate: true })
      manager.loadBlock('c', 'unique')

      const prompt = manager.assembleSystemPrompt()
      const sharedCount = prompt.split('shared').length - 1
      expect(sharedCount).toBe(1)
      expect(prompt).toContain('unique')
    })
  })
})
