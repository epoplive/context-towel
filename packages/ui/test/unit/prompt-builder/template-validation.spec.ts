import { describe, it, expect } from 'vitest'
import {
  sanitizeTemplate,
  validateTemplate,
  validateTemplates,
  generateTemplateId,
  isTemplateSafe,
  createSafeTemplate,
} from '../../../src/prompt-builder/utils/template-validation'

describe('sanitizeTemplate', () => {
  it('removes script tags', () => {
    const result = sanitizeTemplate('hello <script>alert(1)</script> world')
    expect(result).not.toContain('<script>')
    expect(result).toContain('hello')
    expect(result).toContain('world')
  })

  it('removes javascript: protocols', () => {
    const result = sanitizeTemplate('click javascript:alert(1)')
    expect(result).not.toContain('javascript:')
  })

  it('removes iframe tags', () => {
    const result = sanitizeTemplate('content <iframe src="evil"></iframe> more')
    expect(result).not.toContain('<iframe')
  })

  it('removes control characters', () => {
    const result = sanitizeTemplate('hello\x00\x01\x02world')
    expect(result).toBe('helloworld')
  })

  it('normalizes line endings', () => {
    const result = sanitizeTemplate('line1\r\nline2\rline3')
    expect(result).toBe('line1\nline2\nline3')
  })

  it('trims whitespace', () => {
    const result = sanitizeTemplate('  hello  ')
    expect(result).toBe('hello')
  })

  it('preserves safe content', () => {
    const safe = 'You are a helpful {{language}} assistant.'
    expect(sanitizeTemplate(safe)).toBe(safe)
  })
})

describe('validateTemplate', () => {
  const validTemplate = {
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    prompt: 'You are a helpful assistant.',
    category: 'general' as const,
  }

  it('validates a valid template', () => {
    const result = validateTemplate(validTemplate)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing name', () => {
    const result = validateTemplate({ ...validTemplate, name: undefined })
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('name'))).toBe(true)
  })

  it('rejects empty name', () => {
    const result = validateTemplate({ ...validTemplate, name: '' })
    expect(result.isValid).toBe(false)
  })

  it('rejects name over 100 chars', () => {
    const result = validateTemplate({ ...validTemplate, name: 'x'.repeat(101) })
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('100'))).toBe(true)
  })

  it('rejects missing prompt', () => {
    const result = validateTemplate({ ...validTemplate, prompt: undefined })
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('prompt'))).toBe(true)
  })

  it('rejects prompt over 10000 chars', () => {
    const result = validateTemplate({ ...validTemplate, prompt: 'x'.repeat(10001) })
    expect(result.isValid).toBe(false)
  })

  it('rejects missing description', () => {
    const result = validateTemplate({ ...validTemplate, description: undefined })
    expect(result.isValid).toBe(false)
  })

  it('rejects description over 500 chars', () => {
    const result = validateTemplate({ ...validTemplate, description: 'x'.repeat(501) })
    expect(result.isValid).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = validateTemplate({ ...validTemplate, category: 'invalid' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('category'))).toBe(true)
  })

  it('rejects dangerous content in name', () => {
    const result = validateTemplate({ ...validTemplate, name: '<script>bad</script>' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('dangerous'))).toBe(true)
  })

  it('rejects eval() in prompt', () => {
    const result = validateTemplate({ ...validTemplate, prompt: 'use eval() here' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('JavaScript'))).toBe(true)
  })

  it('warns about very long prompts', () => {
    const result = validateTemplate({ ...validTemplate, prompt: 'x'.repeat(5001) })
    expect(result.warnings.some((w) => w.includes('performance'))).toBe(true)
  })

  it('rejects invalid ID format', () => {
    const result = validateTemplate({ ...validTemplate, id: 'bad id with spaces' })
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('ID'))).toBe(true)
  })

  it('accepts valid ID format', () => {
    const result = validateTemplate({ ...validTemplate, id: 'valid-id_123' })
    expect(result.isValid).toBe(true)
  })
})

describe('validateTemplates', () => {
  const validTemplate = {
    id: 'test-1',
    name: 'Test One',
    description: 'First template',
    prompt: 'Hello',
    category: 'general' as const,
  }

  it('validates a batch of valid templates', () => {
    const result = validateTemplates([
      validTemplate,
      { ...validTemplate, id: 'test-2', name: 'Test Two' },
    ])
    expect(result.isValid).toBe(true)
  })

  it('detects duplicate names', () => {
    const result = validateTemplates([
      validTemplate,
      { ...validTemplate, id: 'test-2', name: 'Test One' },
    ])
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('Duplicate template name'))).toBe(true)
  })

  it('detects duplicate IDs', () => {
    const result = validateTemplates([
      validTemplate,
      { ...validTemplate, name: 'Different Name' },
    ])
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('Duplicate template ID'))).toBe(true)
  })
})

describe('generateTemplateId', () => {
  it('generates ID from name', () => {
    expect(generateTemplateId('My Cool Template')).toBe('my-cool-template')
  })

  it('removes special characters', () => {
    expect(generateTemplateId('Hello! @World #123')).toBe('hello-world-123')
  })

  it('truncates to 50 chars', () => {
    const longName = 'a'.repeat(100)
    expect(generateTemplateId(longName).length).toBeLessThanOrEqual(50)
  })

  it('falls back for empty name', () => {
    const id = generateTemplateId('')
    expect(id).toMatch(/^template-\d+$/)
  })
})

describe('isTemplateSafe', () => {
  it('returns true for safe template', () => {
    expect(
      isTemplateSafe({
        id: 'safe',
        name: 'Safe',
        description: 'A safe template',
        prompt: 'Hello',
        category: 'general',
      }),
    ).toBe(true)
  })

  it('returns false for unsafe template', () => {
    expect(
      isTemplateSafe({
        id: 'unsafe',
        name: '<script>bad</script>',
        description: 'Unsafe',
        prompt: 'Hello',
        category: 'general',
      }),
    ).toBe(false)
  })
})

describe('createSafeTemplate', () => {
  it('creates a sanitized template', () => {
    const result = createSafeTemplate({
      name: 'My Template',
      description: 'A good template',
      prompt: 'You are helpful.',
      category: 'general',
    })
    expect(result.name).toBe('My Template')
    expect(result.id).toBe('my-template')
  })

  it('generates ID if not provided', () => {
    const result = createSafeTemplate({
      name: 'Test',
      description: 'Desc',
      prompt: 'Prompt',
      category: 'custom',
    })
    expect(result.id).toBe('test')
  })

  it('creates versioned template when version is present', () => {
    const result = createSafeTemplate({
      name: 'Versioned',
      description: 'Has version',
      prompt: 'Hello',
      category: 'coding',
      version: '2.0.0',
    })
    expect('version' in result).toBe(true)
    expect((result as { version: string }).version).toBe('2.0.0')
  })

  it('throws for invalid template', () => {
    expect(() =>
      createSafeTemplate({
        name: '',
        prompt: '',
        description: '',
        category: 'invalid',
      }),
    ).toThrow('Cannot create safe template')
  })
})
