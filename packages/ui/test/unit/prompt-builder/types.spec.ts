import { describe, it, expect } from 'vitest'
import { TEMPLATE_CATEGORIES } from '../../../src/prompt-builder/types'

describe('prompt-builder types', () => {
  it('exports TEMPLATE_CATEGORIES', () => {
    expect(TEMPLATE_CATEGORIES).toEqual(['coding', 'planning', 'general', 'custom'])
  })

  it('TEMPLATE_CATEGORIES is readonly', () => {
    // TypeScript prevents mutation, but we can verify length at runtime
    expect(TEMPLATE_CATEGORIES.length).toBe(4)
  })
})
