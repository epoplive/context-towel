// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect } from 'vitest'

import { TaskCard } from '../TaskCard'
import { defaultTheme } from '../../../blocks/types'
import type { TaskData } from '../types'

const flushPromises = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

function makeTask(overrides: Partial<TaskData> = {}): TaskData {
  return {
    id: 'sizing-test',
    title: 'Test Task for Sizing',
    status: 'todo',
    priority: 'medium',
    blockedBy: [],
    blocks: [],
    tags: ['tag1', 'tag2'],
    description: 'Description text',
    checklist: [
      { text: 'Step one', checked: false },
      { text: 'Step two', checked: true },
    ],
    log: [
      { timestamp: '2026-01-01', entry: 'Started' },
    ],
    notes: 'Some notes',
    progress: 50,
    ...overrides,
  }
}

/**
 * Parse an em value string like '0.75em' and return the numeric part.
 * Returns Infinity for non-em values (they pass the minimum check).
 */
function parseEmValue(value: string): number {
  const match = value.match(/^([\d.]+)em$/)
  if (!match) return Infinity
  return parseFloat(match[1])
}

describe('TaskCard font size readability', () => {
  it('no inline fontSize value in full detail is smaller than 0.75em', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        React.createElement(TaskCard, {
          data: makeTask(),
          detail: 'full',
          theme: defaultTheme,
        })
      )
    })

    await flushPromises()

    // Collect all elements with inline font-size style
    const allElements = container.querySelectorAll('*')
    const tooSmall: { tag: string; text: string; fontSize: string }[] = []

    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      const fs = htmlEl.style.fontSize
      if (!fs) return
      const emVal = parseEmValue(fs)
      if (emVal < 0.75) {
        tooSmall.push({
          tag: htmlEl.tagName,
          text: (htmlEl.textContent || '').trim().slice(0, 40),
          fontSize: fs,
        })
      }
    })

    expect(tooSmall).toEqual([])

    act(() => { root.unmount() })
    container.remove()
  })

  it('no inline fontSize value in summary detail is smaller than 0.75em', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        React.createElement(TaskCard, {
          data: makeTask(),
          detail: 'summary',
          theme: defaultTheme,
        })
      )
    })

    await flushPromises()

    const allElements = container.querySelectorAll('*')
    const tooSmall: { tag: string; text: string; fontSize: string }[] = []

    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      const fs = htmlEl.style.fontSize
      if (!fs) return
      const emVal = parseEmValue(fs)
      if (emVal < 0.75) {
        tooSmall.push({
          tag: htmlEl.tagName,
          text: (htmlEl.textContent || '').trim().slice(0, 40),
          fontSize: fs,
        })
      }
    })

    expect(tooSmall).toEqual([])

    act(() => { root.unmount() })
    container.remove()
  })

  it('no inline fontSize value in mini detail is smaller than 0.75em', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        React.createElement(TaskCard, {
          data: makeTask(),
          detail: 'mini',
          theme: defaultTheme,
        })
      )
    })

    await flushPromises()

    const allElements = container.querySelectorAll('*')
    const tooSmall: { tag: string; text: string; fontSize: string }[] = []

    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      const fs = htmlEl.style.fontSize
      if (!fs) return
      const emVal = parseEmValue(fs)
      if (emVal < 0.75) {
        tooSmall.push({
          tag: htmlEl.tagName,
          text: (htmlEl.textContent || '').trim().slice(0, 40),
          fontSize: fs,
        })
      }
    })

    expect(tooSmall).toEqual([])

    act(() => { root.unmount() })
    container.remove()
  })

  it('status badge has readable font size (>= 0.75em)', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        React.createElement(TaskCard, {
          data: makeTask({ status: 'in-progress' }),
          detail: 'full',
          theme: defaultTheme,
        })
      )
    })

    await flushPromises()

    // Find the status badge span (it contains the status text in uppercase)
    const allSpans = container.querySelectorAll('span')
    let statusBadgeFound = false

    allSpans.forEach((span) => {
      const text = span.textContent?.toUpperCase() || ''
      const fs = (span as HTMLElement).style.fontSize
      // Status badge text is 'IN PROGRESS', 'TODO', 'DONE', 'BLOCKED'
      if (text === 'IN PROGRESS' && fs) {
        statusBadgeFound = true
        const emVal = parseEmValue(fs)
        expect(emVal).toBeGreaterThanOrEqual(0.75)
      }
    })

    expect(statusBadgeFound).toBe(true)

    act(() => { root.unmount() })
    container.remove()
  })
})
