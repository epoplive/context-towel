import { describe, it, expect } from 'vitest'
import {
  getPresetTemplates,
  mergeTemplates,
  createTemplate,
  duplicateTemplate,
  createEmptyDraft,
  fillVersionedTemplate,
  normalizeCategory,
} from '../../../src/prompt-builder/services/template-registry'
import type { VersionedTemplate } from '../../../src/prompt-builder/types'

describe('getPresetTemplates', () => {
  it('returns all preset templates', () => {
    const presets = getPresetTemplates()
    expect(presets.length).toBeGreaterThan(0)
    expect(presets.every((t) => t.id && t.name && t.prompt)).toBe(true)
  })

  it('returns a copy (not mutable reference)', () => {
    const a = getPresetTemplates()
    const b = getPresetTemplates()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('does not include mfh-salesman', () => {
    const presets = getPresetTemplates()
    expect(presets.find((t) => t.id === 'mfh-salesman')).toBeUndefined()
  })

  it('includes expected preset IDs', () => {
    const presets = getPresetTemplates()
    const ids = presets.map((t) => t.id)
    expect(ids).toContain('coding-agent')
    expect(ids).toContain('planning-agent')
    expect(ids).toContain('bug-fixing')
    expect(ids).toContain('general')
    expect(ids).toContain('minimal')
  })
})

describe('mergeTemplates', () => {
  const preset: VersionedTemplate = {
    id: 'preset-1',
    name: 'Preset',
    description: 'A preset',
    category: 'general',
    prompt: 'preset prompt',
    version: '1.0.0',
    author: 'system',
  }

  const userTemplate: VersionedTemplate = {
    id: 'user-1',
    name: 'User Custom',
    description: 'A user template',
    category: 'custom',
    prompt: 'user prompt',
    version: '1.0.0',
    author: 'user',
  }

  it('merges presets and user templates', () => {
    const merged = mergeTemplates([preset], [userTemplate])
    expect(merged).toHaveLength(2)
  })

  it('user templates override presets with same ID', () => {
    const override: VersionedTemplate = { ...userTemplate, id: 'preset-1', prompt: 'overridden' }
    const merged = mergeTemplates([preset], [override])
    expect(merged).toHaveLength(1)
    expect(merged[0].prompt).toBe('overridden')
  })

  it('handles empty arrays', () => {
    expect(mergeTemplates([], []).length).toBe(0)
    expect(mergeTemplates([preset], []).length).toBe(1)
    expect(mergeTemplates([], [userTemplate]).length).toBe(1)
  })
})

describe('createTemplate', () => {
  it('creates a new template', () => {
    const t = createTemplate('My Template', 'Hello {{name}}', 'coding')
    expect(t.id).toMatch(/^template-/)
    expect(t.name).toBe('My Template')
    expect(t.prompt).toBe('Hello {{name}}')
    expect(t.category).toBe('coding')
    expect(t.version).toBe('1.0.0')
    expect(t.author).toBe('user')
  })

  it('normalizes invalid category to custom', () => {
    const t = createTemplate('Test', 'Prompt', 'invalid')
    expect(t.category).toBe('custom')
  })

  it('includes description and variables when provided', () => {
    const t = createTemplate(
      'Test',
      'Hello {{name}}',
      'general',
      { name: { type: 'text', label: 'Name' } },
      'A description',
    )
    expect(t.description).toBe('A description')
    expect(t.variables?.name.label).toBe('Name')
  })
})

describe('duplicateTemplate', () => {
  it('creates a copy with new ID', () => {
    const original: VersionedTemplate = {
      id: 'original',
      name: 'Original',
      description: 'Desc',
      category: 'coding',
      prompt: 'Prompt',
      version: '1.0.0',
    }

    const copy = duplicateTemplate(original)
    expect(copy.id).not.toBe('original')
    expect(copy.name).toBe('Original (Copy)')
    expect(copy.category).toBe('custom')
    expect(copy.prompt).toBe('Prompt')
    expect(copy.author).toBe('user')
  })
})

describe('createEmptyDraft', () => {
  it('creates a draft template', () => {
    const draft = createEmptyDraft()
    expect(draft.id).toMatch(/^custom-/)
    expect(draft.name).toBe('New Template')
    expect(draft.prompt).toBe('')
    expect(draft.author).toBe('user')
  })
})

describe('fillVersionedTemplate', () => {
  it('fills template variables', () => {
    const template: VersionedTemplate = {
      id: 'test',
      name: 'Test',
      description: 'Desc',
      category: 'general',
      prompt: 'Hello {{name}}, you are a {{role}}.',
      version: '1.0.0',
    }

    const result = fillVersionedTemplate(template, { name: 'Alice', role: 'developer' })
    expect(result).toBe('Hello Alice, you are a developer.')
  })
})

describe('normalizeCategory', () => {
  it('returns valid categories as-is', () => {
    expect(normalizeCategory('coding')).toBe('coding')
    expect(normalizeCategory('planning')).toBe('planning')
    expect(normalizeCategory('general')).toBe('general')
    expect(normalizeCategory('custom')).toBe('custom')
  })

  it('normalizes invalid categories to custom', () => {
    expect(normalizeCategory('invalid')).toBe('custom')
    expect(normalizeCategory(undefined)).toBe('custom')
    expect(normalizeCategory('')).toBe('custom')
  })
})
