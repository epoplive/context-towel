import { describe, it, expect } from 'vitest'
import { detectLinks, parseLinks } from './parser'

describe('link parser', () => {
  it('detects wiki links', () => {
    expect(detectLinks('See [[Docs/Plan]] for details.')).toBe(true)
  })

  it('detects markdown links', () => {
    expect(detectLinks('See [Plan](docs/plan.md).')).toBe(true)
  })

  it('parses wiki links with alias', () => {
    const result = parseLinks('See [[Docs/Plan|Project Plan]]', '/tmp/test.md')
    expect(result.items).toHaveLength(1)
    const item = result.items[0]
    expect(item.kind).toBe('wiki')
    expect(item.target).toBe('Docs/Plan')
    expect(item.text).toBe('Project Plan')
    expect(item.sourceFile).toBe('/tmp/test.md')
    expect(item.sourceLine).toBe(1)
  })

  it('parses markdown links to markdown docs only', () => {
    const content = 'Docs: [Plan](docs/plan.md) and [Site](https://example.com)'
    const result = parseLinks(content, '/tmp/test.md')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].kind).toBe('markdown')
    expect(result.items[0].target).toBe('docs/plan.md')
  })
})
