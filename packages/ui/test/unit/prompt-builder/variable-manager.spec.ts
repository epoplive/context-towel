import { describe, it, expect } from 'vitest'
import {
  createVariable,
  updateVariable,
  deleteVariable,
  getVariableValues,
  setVariableValues,
  getCombinedValues,
  getVariablesByScope,
  fillTemplate,
} from '../../../src/prompt-builder/services/variable-manager'
import type { VariableDefinition, VariableValue } from '../../../src/prompt-builder/types'

describe('createVariable', () => {
  it('creates a variable definition with defaults', () => {
    const v = createVariable('myVar', 'My Variable', 'text', 'system')

    expect(v.id).toMatch(/^var-/)
    expect(v.name).toBe('myVar')
    expect(v.label).toBe('My Variable')
    expect(v.type).toBe('text')
    expect(v.scope).toBe('system')
    expect(v.required).toBe(false)
    expect(v.category).toBe('general')
    expect(v.createdAt).toBeDefined()
    expect(v.updatedAt).toBeDefined()
  })

  it('creates a variable with all options', () => {
    const v = createVariable('sel', 'Selection', 'select', 'conversation', {
      description: 'A selection',
      options: ['a', 'b', 'c'],
      default: 'b',
      required: true,
      category: 'advanced',
    })

    expect(v.description).toBe('A selection')
    expect(v.options).toEqual(['a', 'b', 'c'])
    expect(v.default).toBe('b')
    expect(v.required).toBe(true)
    expect(v.category).toBe('advanced')
    expect(v.scope).toBe('conversation')
  })
})

describe('updateVariable', () => {
  it('updates a variable in the list', () => {
    const defs: VariableDefinition[] = [
      createVariable('a', 'A', 'text', 'system'),
      createVariable('b', 'B', 'text', 'system'),
    ]

    const updated = updateVariable(defs, defs[0].id, { label: 'Updated A' })

    expect(updated[0].label).toBe('Updated A')
    expect(updated[0].id).toBe(defs[0].id) // ID preserved
    expect(updated[1].label).toBe('B') // Other untouched
  })

  it('does nothing for non-existent ID', () => {
    const defs: VariableDefinition[] = [createVariable('a', 'A', 'text', 'system')]
    const updated = updateVariable(defs, 'nonexistent', { label: 'New' })

    expect(updated).toEqual(defs)
  })
})

describe('deleteVariable', () => {
  it('removes definition and associated values', () => {
    const def = createVariable('a', 'A', 'text', 'system')
    const defs: VariableDefinition[] = [def]
    const vals: VariableValue[] = [
      { variableId: def.id, value: 'hello', scope: 'system', updatedAt: '' },
      { variableId: 'other', value: 'keep', scope: 'system', updatedAt: '' },
    ]

    const result = deleteVariable(defs, vals, def.id)

    expect(result.definitions).toHaveLength(0)
    expect(result.values).toHaveLength(1)
    expect(result.values[0].variableId).toBe('other')
  })
})

describe('getVariableValues', () => {
  const values: VariableValue[] = [
    { variableId: 'v1', value: 'sys-val', scope: 'system', updatedAt: '' },
    { variableId: 'v2', value: 'conv-val', scope: 'conversation', conversationId: 'c1', updatedAt: '' },
    { variableId: 'v3', value: 'conv-other', scope: 'conversation', conversationId: 'c2', updatedAt: '' },
  ]

  it('gets system values', () => {
    const result = getVariableValues(values, 'system')
    expect(result).toEqual({ v1: 'sys-val' })
  })

  it('gets conversation values for specific conversation', () => {
    const result = getVariableValues(values, 'conversation', 'c1')
    expect(result).toEqual({ v2: 'conv-val' })
  })

  it('returns empty for non-matching conversation', () => {
    const result = getVariableValues(values, 'conversation', 'c99')
    expect(result).toEqual({})
  })
})

describe('setVariableValues', () => {
  it('sets new values for a scope', () => {
    const existing: VariableValue[] = [
      { variableId: 'v1', value: 'old', scope: 'system', updatedAt: '' },
    ]

    const result = setVariableValues(existing, { v1: 'new', v2: 'added' }, 'system')

    expect(result).toHaveLength(2)
    expect(result.find((v) => v.variableId === 'v1')?.value).toBe('new')
    expect(result.find((v) => v.variableId === 'v2')?.value).toBe('added')
  })

  it('preserves values from other scopes', () => {
    const existing: VariableValue[] = [
      { variableId: 'v1', value: 'sys', scope: 'system', updatedAt: '' },
      { variableId: 'v2', value: 'conv', scope: 'conversation', conversationId: 'c1', updatedAt: '' },
    ]

    const result = setVariableValues(existing, { v1: 'new-sys' }, 'system')

    expect(result).toHaveLength(2)
    expect(result.find((v) => v.scope === 'conversation')?.value).toBe('conv')
  })

  it('handles conversation-scoped values', () => {
    const result = setVariableValues([], { v1: 'val' }, 'conversation', 'c1')

    expect(result).toHaveLength(1)
    expect(result[0].conversationId).toBe('c1')
    expect(result[0].scope).toBe('conversation')
  })
})

describe('getCombinedValues', () => {
  it('merges system and conversation values', () => {
    const values: VariableValue[] = [
      { variableId: 'v1', value: 'sys', scope: 'system', updatedAt: '' },
      { variableId: 'v2', value: 'sys2', scope: 'system', updatedAt: '' },
      { variableId: 'v1', value: 'conv-override', scope: 'conversation', conversationId: 'c1', updatedAt: '' },
    ]

    const result = getCombinedValues(values, 'c1')

    expect(result).toEqual({
      v1: 'conv-override', // conversation overrides system
      v2: 'sys2',
    })
  })

  it('returns only system values when no conversationId', () => {
    const values: VariableValue[] = [
      { variableId: 'v1', value: 'sys', scope: 'system', updatedAt: '' },
      { variableId: 'v2', value: 'conv', scope: 'conversation', conversationId: 'c1', updatedAt: '' },
    ]

    const result = getCombinedValues(values)
    expect(result).toEqual({ v1: 'sys' })
  })
})

describe('getVariablesByScope', () => {
  it('filters definitions by scope', () => {
    const defs: VariableDefinition[] = [
      createVariable('a', 'A', 'text', 'system'),
      createVariable('b', 'B', 'text', 'conversation'),
      createVariable('c', 'C', 'text', 'system'),
    ]

    expect(getVariablesByScope(defs, 'system')).toHaveLength(2)
    expect(getVariablesByScope(defs, 'conversation')).toHaveLength(1)
  })
})

describe('fillTemplate', () => {
  it('replaces simple variables', () => {
    const result = fillTemplate('Hello {{name}}, welcome to {{place}}!', {
      name: 'Alice',
      place: 'Wonderland',
    })
    expect(result).toBe('Hello Alice, welcome to Wonderland!')
  })

  it('preserves unmatched variables', () => {
    const result = fillTemplate('Hello {{name}}, {{unknown}}!', { name: 'Bob' })
    expect(result).toBe('Hello Bob, {{unknown}}!')
  })

  it('handles conditional blocks - truthy', () => {
    const result = fillTemplate('Start {{#if show}}visible{{/if}} end', { show: true })
    expect(result).toBe('Start visible end')
  })

  it('handles conditional blocks - falsy', () => {
    const result = fillTemplate('Start {{#if show}}hidden content{{/if}} end', { show: false })
    expect(result).toBe('Start  end')
  })

  it('handles conditional blocks - undefined (falsy)', () => {
    const result = fillTemplate('Start {{#if missing}}gone{{/if}} end', {})
    expect(result).toBe('Start  end')
  })

  it('handles multiple conditionals', () => {
    const result = fillTemplate(
      '{{#if a}}A{{/if}} {{#if b}}B{{/if}}',
      { a: true, b: false },
    )
    expect(result).toBe('A')
  })

  it('handles mixed variables and conditionals', () => {
    const result = fillTemplate(
      'Hello {{name}}! {{#if admin}}Admin mode{{/if}}',
      { name: 'Alice', admin: true },
    )
    expect(result).toBe('Hello Alice! Admin mode')
  })

  it('trims result', () => {
    const result = fillTemplate('  hello  ', {})
    expect(result).toBe('hello')
  })
})
