import { describe, it, expect } from 'vitest'
import {
  BASIC_CAPABILITIES,
  resolveCapabilities,
  hasCapability,
} from '../../src/blocks/types'
import type { BlockInstance, BlockCapabilities } from '../../src/blocks/types'

function makeBlock(caps?: Partial<BlockCapabilities>): BlockInstance {
  return {
    type: 'test',
    data: null,
    source: { filePath: 'test.md', range: { startOffset: 0, endOffset: 100, startLine: 1, endLine: 10 }, raw: '' },
    capabilities: caps ? { ...BASIC_CAPABILITIES, ...caps } : undefined,
  }
}

describe('BASIC_CAPABILITIES', () => {
  it('defaults all flags to false', () => {
    expect(BASIC_CAPABILITIES.expandable).toBe(false)
    expect(BASIC_CAPABILITIES.crossReferenced).toBe(false)
    expect(BASIC_CAPABILITIES.layered).toBe(false)
    expect(BASIC_CAPABILITIES.typed).toBe(false)
    expect(BASIC_CAPABILITIES.interactive).toBe(false)
    expect(BASIC_CAPABILITIES.compilable).toBe(false)
  })

  it('defaults to basic parsing level', () => {
    expect(BASIC_CAPABILITIES.parsingLevel).toBe('basic')
  })

  it('defaults confidence to 1.0', () => {
    expect(BASIC_CAPABILITIES.confidence).toBe(1.0)
  })
})

describe('resolveCapabilities', () => {
  it('returns BASIC_CAPABILITIES when no overrides', () => {
    const result = resolveCapabilities()
    expect(result).toEqual(BASIC_CAPABILITIES)
  })

  it('merges definition-level capabilities', () => {
    const result = resolveCapabilities({
      parsingLevel: 'semantic',
      expandable: true,
      crossReferenced: true,
    })
    expect(result.parsingLevel).toBe('semantic')
    expect(result.expandable).toBe(true)
    expect(result.crossReferenced).toBe(true)
    // Unset fields default to basic
    expect(result.layered).toBe(false)
    expect(result.interactive).toBe(false)
  })

  it('instance overrides take precedence over definition', () => {
    const result = resolveCapabilities(
      { parsingLevel: 'semantic', confidence: 1.0 },
      { confidence: 0.7 },
    )
    expect(result.parsingLevel).toBe('semantic')
    expect(result.confidence).toBe(0.7)
  })

  it('full override chain: basic → definition → instance', () => {
    const result = resolveCapabilities(
      { expandable: true, crossReferenced: true },
      { expandable: false }, // instance overrides definition
    )
    expect(result.expandable).toBe(false)
    expect(result.crossReferenced).toBe(true)
  })
})

describe('hasCapability', () => {
  it('returns false for blocks without capabilities', () => {
    const block = makeBlock()
    block.capabilities = undefined
    expect(hasCapability(block, 'expandable')).toBe(false)
    expect(hasCapability(block, 'crossReferenced')).toBe(false)
  })

  it('returns true when capability is set', () => {
    const block = makeBlock({ expandable: true, crossReferenced: true })
    expect(hasCapability(block, 'expandable')).toBe(true)
    expect(hasCapability(block, 'crossReferenced')).toBe(true)
  })

  it('returns false when capability is not set', () => {
    const block = makeBlock({ expandable: true })
    expect(hasCapability(block, 'layered')).toBe(false)
    expect(hasCapability(block, 'compilable')).toBe(false)
  })
})

describe('index block capabilities', () => {
  it('has full semantic capabilities declared', async () => {
    // Import dynamically to avoid pulling in React deps in pure tests
    const { indexBlockDefinition } = await import('../../src/plugins/index/index')
    const caps = resolveCapabilities(indexBlockDefinition.capabilities)

    expect(caps.parsingLevel).toBe('semantic')
    expect(caps.expandable).toBe(true)
    expect(caps.crossReferenced).toBe(true)
    expect(caps.layered).toBe(true)
    expect(caps.typed).toBe(true)
    expect(caps.compilable).toBe(true)
    expect(caps.interactive).toBe(false)
    expect(caps.confidence).toBe(1.0)
  })
})
