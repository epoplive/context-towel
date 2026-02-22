import { describe, it, expect, beforeEach } from 'vitest'
import { PromptBlockStateManager } from '../../../src/prompt/prompt-block-state'
import { PromptComposer } from '../../../src/prompt/prompt-composition'

describe('PromptComposer', () => {
  let state: PromptBlockStateManager
  let composer: PromptComposer

  beforeEach(() => {
    state = new PromptBlockStateManager()
    composer = new PromptComposer(state)
  })

  it('returns empty string when no blocks exist', () => {
    expect(composer.assemble()).toBe('')
  })

  it('concatenates blocks in priority order with double newlines', () => {
    state.loadBlock('low', 'Low priority block', { priority: 'low' })
    state.loadBlock('sys', 'System block', { priority: 'system' })
    state.loadBlock('mid', 'Normal block')

    const result = composer.assemble()
    expect(result).toBe('System block\n\nNormal block\n\nLow priority block')
  })

  it('trims block content before joining', () => {
    state.loadBlock('a', '  padded content  ')
    expect(composer.assemble()).toBe('padded content')
  })

  it('loadBlock rejects empty content so composer never sees empty blocks', () => {
    // loadBlock enforces the contract: empty/whitespace content is rejected.
    // The composer therefore never needs to skip empty blocks at assembly time.
    expect(() => state.loadBlock('empty', '   ')).toThrow('content must be a non-empty string')
    state.loadBlock('valid', 'content')
    expect(composer.assemble()).toBe('content')
  })

  it('deduplicates blocks with deduplicate option', () => {
    state.loadBlock('a', 'same content', { deduplicate: true })
    state.loadBlock('b', 'same content', { deduplicate: true })
    state.loadBlock('c', 'different content')

    const result = composer.assemble()
    // 'same content' should appear only once
    const occurrences = result.split('same content').length - 1
    expect(occurrences).toBe(1)
    expect(result).toContain('different content')
  })

  it('does not deduplicate blocks without the deduplicate option', () => {
    state.loadBlock('a', 'same content')
    state.loadBlock('b', 'same content')

    const result = composer.assemble()
    const occurrences = result.split('same content').length - 1
    expect(occurrences).toBe(2)
  })

  it('deduplication is content-based (different IDs, same trimmed content)', () => {
    state.loadBlock('first', 'exact match', { priority: 'system', deduplicate: true })
    state.loadBlock('second', '  exact match  ', { priority: 'normal', deduplicate: true })

    const result = composer.assemble()
    // Only the first occurrence (system priority) should appear
    expect(result).toBe('exact match')
  })

  it('handles single block correctly', () => {
    state.loadBlock('only', 'solo content')
    expect(composer.assemble()).toBe('solo content')
  })

  it('respects full priority ordering across all four levels', () => {
    state.loadBlock('low', 'D', { priority: 'low' })
    state.loadBlock('high', 'B', { priority: 'high' })
    state.loadBlock('system', 'A', { priority: 'system' })
    state.loadBlock('normal', 'C', { priority: 'normal' })

    expect(composer.assemble()).toBe('A\n\nB\n\nC\n\nD')
  })

  it('handles multiline block content', () => {
    state.loadBlock('multi', 'line 1\nline 2\nline 3')
    state.loadBlock('single', 'single line')

    const result = composer.assemble()
    expect(result).toBe('line 1\nline 2\nline 3\n\nsingle line')
  })
})
