// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { blockRegistry } from '@context-towel/card-library'

import { MarkdownRenderer } from '../MarkdownRenderer'

const flushPromises = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

describe('MarkdownRenderer typed blocks', () => {
  it('renders task blocks as cards (no portal placeholders)', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '```task',
      'id: test-task',
      'title: Hello Task',
      'status: todo',
      'priority: low',
      'checklist:',
      '  - [ ] First item',
      '```',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('Hello Task')
    expect(container.innerHTML).not.toContain('data-block-type="task"')
    expect(container.querySelector('.markdown-code-block')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders stub-only block types as normal code blocks', async () => {
    const type = 'stubonly-test'
    if (!blockRegistry.has(type)) {
      // Register a stub definition with no components.
      // The markdown renderer should fall back to a normal code block.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockRegistry.register({ type, name: 'StubOnly' } as any)
    }

    const md = [
      '```stubonly-test',
      'hello: world',
      '```',
    ].join('\n')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.querySelector('.markdown-code-block')).not.toBeNull()
    expect(container.textContent || '').toContain('hello: world')
    expect(container.innerHTML).not.toContain('data-block-type="stubonly-test"')

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
