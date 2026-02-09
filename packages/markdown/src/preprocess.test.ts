import { describe, expect, it } from 'vitest'

import { stripWrapperTagLines } from './preprocess'

describe('stripWrapperTagLines', () => {
  it('strips INSTRUCTIONS wrapper tag lines but preserves inner markdown', () => {
    const input = [
      '<INSTRUCTIONS>',
      '# Title',
      '',
      '- item',
      '</INSTRUCTIONS>',
      '',
    ].join('\n')

    const output = stripWrapperTagLines(input)

    expect(output).toContain('# Title')
    expect(output).toContain('- item')
    expect(output.toLowerCase()).not.toContain('instructions')
  })

  it('strips environment_context wrapper blocks entirely (open..close)', () => {
    const input = [
      'before',
      '<environment_context>',
      '  <cwd>/tmp</cwd>',
      '  <shell>zsh</shell>',
      '</environment_context>',
      'after',
    ].join('\n')

    const output = stripWrapperTagLines(input)

    expect(output).toContain('before')
    expect(output).toContain('after')
    expect(output).not.toContain('cwd')
    expect(output).not.toContain('shell')
    expect(output.toLowerCase()).not.toContain('environment_context')
  })

  it('does not strip wrapper blocks when inside a fenced code block', () => {
    const input = [
      '```text',
      '<environment_context>',
      '  <cwd>/tmp</cwd>',
      '</environment_context>',
      '```',
      '',
    ].join('\n')

    const output = stripWrapperTagLines(input)

    expect(output).toContain('<environment_context>')
    expect(output).toContain('<cwd>/tmp</cwd>')
    expect(output).toContain('```text')
  })
})

