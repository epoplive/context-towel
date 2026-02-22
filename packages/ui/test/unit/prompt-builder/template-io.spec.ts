import { describe, it, expect } from 'vitest'
import {
  exportTemplates,
  importTemplates,
  validateImportFile,
  parseTemplateImport,
} from '../../../src/prompt-builder/utils/template-io'

const sampleTemplate = {
  id: 'test-1',
  name: 'Test Template',
  description: 'A test',
  prompt: 'Hello world',
  category: 'general' as const,
}

const sampleVersioned = {
  ...sampleTemplate,
  version: '1.0.0',
  author: 'user',
}

describe('exportTemplates', () => {
  it('exports all templates to JSON', () => {
    const json = exportTemplates([sampleTemplate])
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe('1.0.0')
    expect(parsed.exportDate).toBeDefined()
    expect(parsed.templates).toHaveLength(1)
    expect(parsed.templates[0].id).toBe('test-1')
    expect(parsed.metadata.source).toBe('context-towel')
    expect(parsed.metadata.templateCount).toBe(1)
    expect(parsed.metadata.categories).toContain('general')
  })

  it('exports selected templates only', () => {
    const templates = [
      sampleTemplate,
      { ...sampleTemplate, id: 'test-2', name: 'Other' },
    ]
    const json = exportTemplates(templates, ['test-1'])
    const parsed = JSON.parse(json)

    expect(parsed.templates).toHaveLength(1)
    expect(parsed.templates[0].id).toBe('test-1')
  })

  it('exports empty array when no ids match', () => {
    const json = exportTemplates([sampleTemplate], ['nonexistent'])
    const parsed = JSON.parse(json)
    expect(parsed.templates).toHaveLength(0)
  })
})

describe('importTemplates', () => {
  it('imports valid templates', () => {
    const exportJson = exportTemplates([sampleVersioned])
    const result = importTemplates(exportJson, [])

    expect(result.success).toBe(true)
    expect(result.importedCount).toBe(1)
    expect(result.importedTemplates[0].name).toBe('Test Template')
  })

  it('skips duplicates by default', () => {
    const exportJson = exportTemplates([sampleVersioned])
    const result = importTemplates(exportJson, [sampleVersioned])

    expect(result.success).toBe(false)
    expect(result.importedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(result.warnings.some((w) => w.includes('Skipped duplicate'))).toBe(true)
  })

  it('generates new ID when not replacing', () => {
    const exportJson = exportTemplates([sampleVersioned])
    const result = importTemplates(exportJson, [sampleVersioned], {
      skipDuplicates: false,
      replaceExisting: false,
    })

    expect(result.success).toBe(true)
    expect(result.importedTemplates[0].id).not.toBe(sampleVersioned.id)
  })

  it('replaces existing when replaceExisting is true', () => {
    const exportJson = exportTemplates([{ ...sampleVersioned, prompt: 'Updated prompt' }])
    const result = importTemplates(exportJson, [sampleVersioned], {
      replaceExisting: true,
    })

    expect(result.success).toBe(true)
    expect(result.importedTemplates[0].prompt).toBe('Updated prompt')
  })

  it('rejects invalid JSON', () => {
    const result = importTemplates('not json', [])
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects non-object data', () => {
    const result = importTemplates('"string"', [])
    expect(result.success).toBe(false)
  })

  it('rejects missing templates array', () => {
    const result = importTemplates('{"version":"1.0.0"}', [])
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes('templates must be an array'))).toBe(true)
  })

  it('rejects templates with missing fields', () => {
    const data = {
      version: '1.0.0',
      templates: [{ id: 'test' }], // Missing required fields
    }
    const result = importTemplates(JSON.stringify(data), [])
    expect(result.success).toBe(false)
  })

  it('warns about unknown categories', () => {
    const data = {
      version: '1.0.0',
      templates: [
        {
          id: 'test',
          name: 'Test',
          description: 'Desc',
          prompt: 'Prompt',
          category: 'unknown',
        },
      ],
    }
    const result = importTemplates(JSON.stringify(data), [], { validateContent: false })
    // The import should still succeed with the normalized category
    expect(result.warnings.some((w) => w.includes('Unknown category'))).toBe(true)
  })

  it('warns about version mismatch', () => {
    const data = {
      version: '2.0.0',
      templates: [
        {
          id: 'test',
          name: 'Test',
          description: 'Desc',
          prompt: 'Prompt',
          category: 'general',
        },
      ],
    }
    const result = importTemplates(JSON.stringify(data), [])
    expect(result.warnings.some((w) => w.includes('Version mismatch'))).toBe(true)
  })
})

describe('validateImportFile', () => {
  it('accepts valid JSON file', () => {
    const file = new File(['{}'], 'test.json', { type: 'application/json' })
    expect(validateImportFile(file).isValid).toBe(true)
  })

  it('rejects non-JSON file', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const result = validateImportFile(file)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('JSON')
  })

  it('rejects empty file', () => {
    const file = new File([], 'test.json', { type: 'application/json' })
    const result = validateImportFile(file)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('accepts file by extension even without MIME type', () => {
    const file = new File(['{}'], 'test.json', { type: '' })
    expect(validateImportFile(file).isValid).toBe(true)
  })
})

describe('parseTemplateImport', () => {
  it('parses valid import successfully', () => {
    const exportJson = exportTemplates([sampleVersioned])
    const result = parseTemplateImport(exportJson, [])

    expect(result.success).toBe(true)
    expect(result.imported).toBe(1)
    expect(result.templates).toHaveLength(1)
  })

  it('returns error for invalid import', () => {
    const result = parseTemplateImport('invalid json', [])

    expect(result.success).toBe(false)
    expect(result.imported).toBe(0)
    expect(result.error).toBeDefined()
  })
})
