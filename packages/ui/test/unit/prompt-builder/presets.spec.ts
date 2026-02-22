import { describe, it, expect } from 'vitest'
import { PRESET_TEMPLATES } from '../../../src/prompt-builder/templates/presets'

describe('PRESET_TEMPLATES', () => {
  it('contains expected number of templates', () => {
    expect(PRESET_TEMPLATES.length).toBeGreaterThanOrEqual(5)
  })

  it('all templates have required fields', () => {
    for (const t of PRESET_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.category).toBeTruthy()
      expect(t.prompt).toBeTruthy()
      expect(t.version).toBe('1.0.0')
      expect(t.author).toBe('system')
    }
  })

  it('has unique IDs', () => {
    const ids = PRESET_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique names', () => {
    const names = PRESET_TEMPLATES.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('does not include mfh-salesman', () => {
    expect(PRESET_TEMPLATES.find((t) => t.id === 'mfh-salesman')).toBeUndefined()
    expect(PRESET_TEMPLATES.find((t) => t.name.toLowerCase().includes('salesman'))).toBeUndefined()
  })

  it('all categories are valid', () => {
    const validCategories = ['coding', 'planning', 'general', 'custom']
    for (const t of PRESET_TEMPLATES) {
      expect(validCategories).toContain(t.category)
    }
  })

  it('templates with variables have valid variable definitions', () => {
    for (const t of PRESET_TEMPLATES) {
      if (!t.variables) continue
      for (const [key, v] of Object.entries(t.variables)) {
        expect(key).toBeTruthy()
        expect(v.type).toBeTruthy()
        expect(v.label).toBeTruthy()
        expect(['text', 'textarea', 'select', 'number', 'boolean']).toContain(v.type)
        if (v.type === 'select') {
          expect(Array.isArray(v.options)).toBe(true)
          expect(v.options!.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('coding-agent template has language and framework variables', () => {
    const codingAgent = PRESET_TEMPLATES.find((t) => t.id === 'coding-agent')
    expect(codingAgent).toBeDefined()
    expect(codingAgent!.variables).toBeDefined()
    expect(codingAgent!.variables!['language']).toBeDefined()
    expect(codingAgent!.variables!['framework']).toBeDefined()
    expect(codingAgent!.variables!['language'].type).toBe('select')
    expect(codingAgent!.variables!['framework'].type).toBe('text')
  })

  it('general template has tone variable', () => {
    const general = PRESET_TEMPLATES.find((t) => t.id === 'general')
    expect(general).toBeDefined()
    expect(general!.variables!['tone']).toBeDefined()
    expect(general!.variables!['tone'].type).toBe('select')
  })

  it('minimal template has no variables', () => {
    const minimal = PRESET_TEMPLATES.find((t) => t.id === 'minimal')
    expect(minimal).toBeDefined()
    expect(Object.keys(minimal!.variables || {})).toHaveLength(0)
  })
})
