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

  it('ignores wiki links inside fenced code blocks', () => {
    const contentBackticks = [
      'Outside [[Docs/Plan]]',
      '',
      '```task',
      'blocked-by: [[pro-refactor-backend-command-split]]',
      '```',
    ].join('\n')
    const resultBackticks = parseLinks(contentBackticks, '/tmp/test.md')
    expect(resultBackticks.items).toHaveLength(1)
    expect(resultBackticks.items[0].target).toBe('Docs/Plan')

    const contentTildes = [
      'Outside [[Docs/Plan]]',
      '',
      '~~~task',
      'blocked-by: [[pro-refactor-backend-command-split]]',
      '~~~',
    ].join('\n')
    const resultTildes = parseLinks(contentTildes, '/tmp/test.md')
    expect(resultTildes.items).toHaveLength(1)
    expect(resultTildes.items[0].target).toBe('Docs/Plan')
  })

  it('ignores wiki links inside inline code', () => {
    const content = 'Use `[[NotALink]]` and see [[RealLink]].'
    expect(detectLinks(content)).toBe(true)
    const result = parseLinks(content, '/tmp/test.md')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].target).toBe('RealLink')
  })

  it('ignores markdown links inside fenced code blocks', () => {
    const contentBackticks = [
      '```md',
      '[Plan](docs/plan.md)',
      '```',
    ].join('\n')
    expect(detectLinks(contentBackticks)).toBe(false)
    const resultBackticks = parseLinks(contentBackticks, '/tmp/test.md')
    expect(resultBackticks.items).toHaveLength(0)

    const contentTildes = [
      '~~~md',
      '[Plan](docs/plan.md)',
      '~~~',
    ].join('\n')
    expect(detectLinks(contentTildes)).toBe(false)
    const resultTildes = parseLinks(contentTildes, '/tmp/test.md')
    expect(resultTildes.items).toHaveLength(0)
  })
})
