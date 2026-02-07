// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { TaskItem } from './types'
import { DetailedTaskCard, InlineTaskCard } from './components'

const makeTask = (overrides: Partial<TaskItem> & Pick<TaskItem, 'id'>): TaskItem => ({
  id: overrides.id,
  title: overrides.title ?? `Task ${overrides.id}`,
  status: overrides.status ?? 'todo',
  priority: overrides.priority ?? 'medium',
  category: overrides.category,
  owner: overrides.owner,
  activeForm: overrides.activeForm,
  blockedBy: overrides.blockedBy ?? [],
  blocks: overrides.blocks ?? [],
  tags: overrides.tags ?? [],
  labels: overrides.labels ?? overrides.tags ?? [],
  description: overrides.description ?? '',
  checklist: overrides.checklist ?? [],
  log: overrides.log ?? [],
  notes: overrides.notes ?? '',
  progress: overrides.progress ?? 0,
  rawContent: overrides.rawContent ?? '',
  sourceFile: overrides.sourceFile ?? '/tmp/doc.md',
  sourceLine: overrides.sourceLine,
  sourceEndLine: overrides.sourceEndLine,
})

describe('Task cards', () => {
  it('InlineTaskCard renders title and checklist summary', () => {
    const task = makeTask({
      id: 't1',
      title: 'Ship it',
      status: 'in-progress',
      priority: 'high',
      progress: 50,
      checklist: [
        { checked: true, text: 'A' },
        { checked: false, text: 'B' },
        { checked: false, text: 'C' },
        { checked: false, text: 'D' },
        { checked: false, text: 'E' },
        { checked: false, text: 'F' },
      ],
    })

    const markup = renderToStaticMarkup(<InlineTaskCard task={task} />)
    expect(markup).toContain('Ship it')
    expect(markup).toContain('A')
    expect(markup).toContain('B')
    expect(markup).toContain('C')
    expect(markup).toContain('D')
    expect(markup).toContain('+2 more')
  })

  it('DetailedTaskCard expands checklist in compact mode when clicked', async () => {
    const task = makeTask({
      id: 't2',
      title: 'Do the thing',
      checklist: [
        { checked: false, text: 'Step 1' },
        { checked: true, text: 'Step 2' },
      ],
      progress: 50,
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<DetailedTaskCard task={task} compact />)
    })

    // Compact mode starts collapsed; checklist items are not rendered yet.
    expect(container.textContent).not.toContain('Step 1')

    const arrow = Array.from(container.querySelectorAll('span')).find((el) => el.textContent === '▶')
    expect(arrow).toBeTruthy()

    await act(async () => {
      arrow?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('Step 1')
    expect(container.textContent).toContain('Step 2')

    act(() => root.unmount())
    container.remove()
  })

  it('DetailedTaskCard calls onToggleCheckbox when clicking a checklist item', async () => {
    const onToggleCheckbox = vi.fn().mockResolvedValue(undefined)
    const task = makeTask({
      id: 't3',
      title: 'Checklist',
      checklist: [
        { checked: false, text: 'One' },
        { checked: true, text: 'Two' },
      ],
      progress: 50,
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<DetailedTaskCard task={task} onToggleCheckbox={onToggleCheckbox} />)
    })

    const item = Array.from(container.querySelectorAll('span')).find((el) => el.textContent === 'One')
    expect(item).toBeTruthy()

    await act(async () => {
      item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      // allow the async handler to resolve
      await Promise.resolve()
    })

    expect(onToggleCheckbox).toHaveBeenCalledWith('One', false)

    act(() => root.unmount())
    container.remove()
  })
})

