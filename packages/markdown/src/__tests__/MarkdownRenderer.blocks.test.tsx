// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { blockRegistry } from '@context-towel/card-library'
import type { CodeViewerComponent } from '../markdown-renderer/types'

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

  it('renders question blocks as cards', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '```question',
      'text: What framework?',
      'options:',
      '  - id: react',
      '    label: React',
      '  - id: vue',
      '    label: Vue',
      '```',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('What framework?')
    expect(container.textContent || '').toContain('React')
    expect(container.textContent || '').toContain('Vue')
    expect(container.querySelector('.markdown-code-block')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('unwraps a typed block wrapped inside a plain code fence', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '~~~',
      '```task',
      'id: wrapped-task',
      'title: Wrapped Task',
      'status: todo',
      'priority: low',
      '```',
      '~~~',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('Wrapped Task')
    expect(container.querySelector('.markdown-code-block')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('unwraps a typed block wrapped inside a text code fence', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '~~~text',
      '```task',
      'id: wrapped-task-text',
      'title: Wrapped Task (text)',
      'status: todo',
      'priority: low',
      '```',
      '~~~',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('Wrapped Task (text)')
    expect(container.querySelector('.markdown-code-block')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('repairs conflicting wrapper fences (```text wrapping ```task) and unwraps', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    // This is a common "LLM wrapper" pattern, but it's invalid markdown when both
    // inner + outer fences use the same backtick length. The renderer should
    // repair the wrapper so the typed block can be unwrapped.
    const md = [
      '```text',
      '```task',
      'id: wrapped-conflict',
      'title: Wrapped Conflict',
      'status: todo',
      'priority: low',
      '```',
      '```',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('Wrapped Conflict')
    expect(container.querySelector('.markdown-code-block')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders tilde-fenced typed blocks as cards', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '~~~task',
      'id: tilde-task',
      'title: Tilde Task',
      'status: todo',
      'priority: low',
      '~~~',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('Tilde Task')
    expect(container.querySelector('.markdown-code-block')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('strips instruction wrapper tag lines for display', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '<INSTRUCTIONS>',
      '# Title',
      '',
      'Hello',
      '</INSTRUCTIONS>',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('Title')
    expect(container.textContent || '').toContain('Hello')
    expect(container.textContent || '').not.toContain('INSTRUCTIONS')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders form blocks as cards', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '```form',
      'id: test-form',
      'title: Project Setup',
      'mode: single',
      'steps:',
      '  - id: step1',
      '    title: Basics',
      '    fields:',
      '      - id: framework',
      '        label: Framework',
      '        type: text',
      '        required: true',
      '```',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} />)
    })

    await flushPromises()

    expect(container.textContent || '').toContain('Project Setup')
    expect(container.textContent || '').toContain('Framework')
    expect(container.querySelector('input')).not.toBeNull()
    expect(container.querySelector('.markdown-code-block')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('uses CodeViewer when codeBlockMode="viewer"', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const CodeViewer: CodeViewerComponent = ((props) => (
      <div data-testid="code-viewer">{props.value}</div>
    )) as CodeViewerComponent

    const md = [
      '```ts',
      'console.log(\"hi\")',
      '```',
    ].join('\n')

    act(() => {
      root.render(<MarkdownRenderer content={md} codeBlockMode="viewer" CodeViewer={CodeViewer as CodeViewerComponent} />)
    })

    await flushPromises()

    expect(container.querySelector('.markdown-code-block')).not.toBeNull()
    const viewer = container.querySelector('[data-testid="code-viewer"]')
    expect(viewer).not.toBeNull()
    expect(viewer?.textContent || '').toContain('console.log')

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
