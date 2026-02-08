import { describe, expect, it } from 'vitest'
import { formatFencedCodeBlock, getFencePreferenceFromRaw } from '../blocks/fences'

describe('formatFencedCodeBlock', () => {
  it('uses a tilde fence when the body contains backtick-only fence lines', () => {
    const body = [
      'description: |',
      '  ```ts',
      '  console.log(1)',
      '  ```',
    ].join('\n')
    const fenced = formatFencedCodeBlock('task', body)
    expect(fenced.startsWith('~~~task\n')).toBe(true)
    expect(fenced.endsWith('\n~~~')).toBe(true)
  })

  it('preserves an existing fence preference when safe', () => {
    const pref = getFencePreferenceFromRaw('````task\nx\n````')
    const fenced = formatFencedCodeBlock('task', 'title: ok', pref)
    expect(fenced.startsWith('````task\n')).toBe(true)
    expect(fenced.endsWith('\n````')).toBe(true)
  })
})

