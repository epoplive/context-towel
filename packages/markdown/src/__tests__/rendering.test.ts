// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { MarkdownRenderer } from '../MarkdownRenderer'

const flushPromises = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

describe('MarkdownRenderer rendering fixes', () => {
  it('markdown-body div does NOT have fontSize in its inline style', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        React.createElement(MarkdownRenderer, { content: '# Hello\n\nSome text here.' })
      )
    })

    await flushPromises()

    const body = container.querySelector('.markdown-body') as HTMLElement | null
    expect(body).not.toBeNull()
    // fontSize must not be hardcoded as an inline style — it must inherit from the parent
    expect(body!.style.fontSize).toBe('')

    act(() => { root.unmount() })
    container.remove()
  })

  it('code blocks in highlight mode do not have "Click to expand" text', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '```typescript',
      'const x = 1',
      '```',
    ].join('\n')

    act(() => {
      root.render(
        React.createElement(MarkdownRenderer, {
          content: md,
          codeBlockMode: 'highlight',
        })
      )
    })

    await flushPromises()

    // Should render a plain code block
    const codeBlock = container.querySelector('.markdown-code-block')
    expect(codeBlock).not.toBeNull()

    // Must NOT have clickable-fullscreen class
    expect(codeBlock!.classList.contains('clickable-fullscreen')).toBe(false)

    // Must NOT contain "Click to expand" text
    expect(container.textContent).not.toContain('Click to expand')

    // Must NOT have cursor: pointer on the block or its header
    const header = container.querySelector('.code-header') as HTMLElement | null
    if (header) {
      expect(header.style.cursor).not.toBe('pointer')
    }

    act(() => { root.unmount() })
    container.remove()
  })

  it('code blocks in highlight mode do not have draggable attribute', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const md = [
      '```javascript',
      'console.log("hello")',
      '```',
    ].join('\n')

    act(() => {
      root.render(
        React.createElement(MarkdownRenderer, {
          content: md,
          codeBlockMode: 'highlight',
        })
      )
    })

    await flushPromises()

    const codeBlock = container.querySelector('.markdown-code-block')
    expect(codeBlock).not.toBeNull()
    // In highlight mode, the block should not be draggable
    expect(codeBlock!.getAttribute('draggable')).toBeNull()

    act(() => { root.unmount() })
    container.remove()
  })

  it('font size inherits from parent container', async () => {
    const outerContainer = document.createElement('div')
    outerContainer.style.fontSize = '20px'
    document.body.appendChild(outerContainer)

    const innerContainer = document.createElement('div')
    outerContainer.appendChild(innerContainer)
    const root = createRoot(innerContainer)

    act(() => {
      root.render(
        React.createElement(MarkdownRenderer, { content: 'Hello world' })
      )
    })

    await flushPromises()

    const body = innerContainer.querySelector('.markdown-body') as HTMLElement | null
    expect(body).not.toBeNull()
    // No inline fontSize — it must not override the container
    expect(body!.style.fontSize).toBe('')

    act(() => { root.unmount() })
    outerContainer.remove()
  })
})
