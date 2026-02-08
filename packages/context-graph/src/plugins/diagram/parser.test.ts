import { describe, expect, it } from 'vitest'
import { detectDiagrams, parseDiagrams } from './parser'

describe('diagram parser fences', () => {
  it('detects mermaid fences for backticks and tildes', () => {
    expect(detectDiagrams('```mermaid\nflowchart TD\n```')).toBe(true)
    expect(detectDiagrams('~~~mermaid\nflowchart TD\n~~~')).toBe(true)
    expect(detectDiagrams('````mermaid\nflowchart TD\n````')).toBe(true)
  })

  it('parses ~~~mermaid blocks and uses the nearest heading as title', () => {
    const content = [
      '# My Diagram',
      '',
      '~~~mermaid',
      'flowchart TD',
      '  A-->B',
      '~~~',
    ].join('\n')

    const result = parseDiagrams(content, '/tmp/test.md')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe('My Diagram')
    expect(result.items[0]?.diagramType).toBe('flowchart')
    expect(result.items[0]?.sourceLine).toBe(4) // first code line (after fence)
  })
})
