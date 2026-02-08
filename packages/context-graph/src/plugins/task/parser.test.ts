import { describe, expect, it } from 'vitest'
import { detectTasks, parseTasks } from './parser'

describe('task parser fences', () => {
  it('detects task fences for backticks and tildes', () => {
    expect(detectTasks('```task\nid: a\n```')).toBe(true)
    expect(detectTasks('~~~task\nid: a\n~~~')).toBe(true)
    expect(detectTasks('````task\nid: a\n````')).toBe(true)
  })

  it('parses ~~~task blocks with embedded ``` fence lines in YAML', () => {
    const content = [
      '~~~task',
      'title: Fence-safe',
      'description: |',
      '  ```ts',
      '  console.log(1)',
      '  ```',
      '~~~',
    ].join('\n')

    const result = parseTasks(content, '/tmp/test.md')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe('Fence-safe')
    expect(result.items[0]?.description).toContain('```ts')
    expect(result.items[0]?.description).toContain('```')
  })

  it('parses variable-length backtick fences (````task)', () => {
    const content = [
      '````task',
      'title: Longer fence',
      'description: |',
      '  ```',
      '  inner',
      '  ```',
      '````',
    ].join('\n')

    const result = parseTasks(content, '/tmp/test.md')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe('Longer fence')
  })
})

