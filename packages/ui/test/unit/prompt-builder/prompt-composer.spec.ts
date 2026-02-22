import { describe, it, expect } from 'vitest'
import {
  composePrompt,
  buildRulesPrompt,
} from '../../../src/prompt-builder/services/prompt-composer'

describe('composePrompt', () => {
  it('composes a simple prompt', () => {
    const result = composePrompt({ mainPrompt: 'You are helpful.' }, 'Hello')
    expect(result.systemPrompt).toBe('You are helpful.')
    expect(result.userMessage).toBe('Hello')
  })

  it('includes context file', () => {
    const result = composePrompt(
      { mainPrompt: 'Main', contextFile: 'Project context here' },
      'Hello',
    )
    expect(result.systemPrompt).toContain('Main')
    expect(result.systemPrompt).toContain('## Project Context')
    expect(result.systemPrompt).toContain('Project context here')
  })

  it('includes additional rules', () => {
    const result = composePrompt(
      { additionalRules: ['Rule 1', 'Rule 2'] },
      'Hello',
    )
    expect(result.systemPrompt).toContain('## Additional Rules')
    expect(result.systemPrompt).toContain('Rule 1')
    expect(result.systemPrompt).toContain('Rule 2')
  })

  it('includes additional instructions', () => {
    const result = composePrompt(
      { additionalInstructions: ['Be concise', 'Use examples'] },
      'Hello',
    )
    expect(result.systemPrompt).toContain('## Additional Instructions')
    expect(result.systemPrompt).toContain('Be concise')
    expect(result.systemPrompt).toContain('Use examples')
  })

  it('composes all parts together', () => {
    const result = composePrompt(
      {
        mainPrompt: 'Main prompt',
        contextFile: 'Context',
        additionalRules: ['Rule A'],
        additionalInstructions: ['Instruction B'],
      },
      'User message',
    )

    expect(result.systemPrompt).toContain('Main prompt')
    expect(result.systemPrompt).toContain('## Project Context\nContext')
    expect(result.systemPrompt).toContain('## Additional Rules\nRule A')
    expect(result.systemPrompt).toContain('## Additional Instructions\nInstruction B')
    expect(result.userMessage).toBe('User message')
  })

  it('returns empty system prompt when no config', () => {
    const result = composePrompt({}, 'Hello')
    expect(result.systemPrompt).toBe('')
    expect(result.userMessage).toBe('Hello')
  })

  it('handles empty strings in config', () => {
    const result = composePrompt(
      { mainPrompt: '  ', contextFile: '', additionalRules: ['', '  '] },
      'Hello',
    )
    expect(result.systemPrompt).toBe('')
  })

  it('handles non-string user message', () => {
    const result = composePrompt({}, undefined as unknown as string)
    expect(result.userMessage).toBe('')
  })
})

describe('buildRulesPrompt', () => {
  it('builds a rules prompt from rules', () => {
    const rules = [
      { name: 'Rule A', content: 'Do thing A', priority: 1 },
      { name: 'Rule B', content: 'Do thing B', priority: 2 },
    ]

    const result = buildRulesPrompt(rules)

    expect(result).toContain('## Code Rules and Guidelines')
    expect(result).toContain('### Rule B') // Higher priority first
    expect(result).toContain('### Rule A')
    expect(result).toContain('Do thing A')
    expect(result).toContain('Do thing B')
    expect(result).toContain('Apply these rules contextually')
  })

  it('sorts by priority descending', () => {
    const rules = [
      { name: 'Low', content: 'low', priority: 1 },
      { name: 'High', content: 'high', priority: 10 },
      { name: 'Mid', content: 'mid', priority: 5 },
    ]

    const result = buildRulesPrompt(rules)
    const highIdx = result.indexOf('### High')
    const midIdx = result.indexOf('### Mid')
    const lowIdx = result.indexOf('### Low')

    expect(highIdx).toBeLessThan(midIdx)
    expect(midIdx).toBeLessThan(lowIdx)
  })

  it('handles empty rules list', () => {
    const result = buildRulesPrompt([])
    expect(result).toContain('## Code Rules and Guidelines')
    // No rule headers
    expect(result).not.toContain('###')
  })

  it('handles rules with no content', () => {
    const result = buildRulesPrompt([{ name: 'Empty Rule' }])
    expect(result).toContain('### Empty Rule')
  })
})
