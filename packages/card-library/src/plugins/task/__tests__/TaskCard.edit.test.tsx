// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TaskCard } from '../TaskCard'
import { defaultTheme } from '../../../blocks/types'
import type { TaskData } from '../types'
import type { BlockEditEvent } from '../../../blocks/types'

// --- Helpers ---

const flushPromises = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

function makeTask(overrides: Partial<TaskData> = {}): TaskData {
  return {
    id: 'task-edit-test',
    title: 'Build the widget',
    status: 'todo',
    priority: 'medium',
    blockedBy: [],
    blocks: [],
    tags: [],
    description: 'A short description',
    checklist: [
      { text: 'Step one', checked: false },
      { text: 'Step two', checked: true },
    ],
    log: [],
    notes: 'Some notes here',
    progress: 0,
    ...overrides,
  }
}

// Mounts a TaskCard and returns container + cleanup
function mountCard(
  data: TaskData,
  onEdit?: (event: BlockEditEvent) => void
): { container: HTMLDivElement; cleanup: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <TaskCard
        data={data}
        detail="full"
        theme={defaultTheme}
        onEdit={onEdit}
      />
    )
  })

  return {
    container,
    cleanup: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

// --- Tests ---

describe('TaskCard edit-in-place', () => {
  let container: HTMLDivElement
  let cleanup: () => void

  afterEach(() => {
    cleanup?.()
  })

  // -----------------------------------------------------------------------
  // Title editing
  // -----------------------------------------------------------------------

  describe('title field', () => {
    it('clicking title enters edit mode when onEdit is provided', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const titleEl = container.querySelector('[data-edit-field="title"]') as HTMLElement
      expect(titleEl).not.toBeNull()
      expect(titleEl.textContent).toContain('Build the widget')

      act(() => { titleEl.click() })
      await flushPromises()

      const input = container.querySelector('[data-edit-input="title"]') as HTMLInputElement
      expect(input).not.toBeNull()
      expect(input.value).toBe('Build the widget')
    })

    it('pressing Enter in title input calls onEdit with new value', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const titleEl = container.querySelector('[data-edit-field="title"]') as HTMLElement
      act(() => { titleEl.click() })
      await flushPromises()

      const input = container.querySelector('[data-edit-input="title"]') as HTMLInputElement
      act(() => {
        // Simulate changing the value
        Object.defineProperty(input, 'value', { writable: true, value: 'Updated title' })
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })

      // Use React's synthetic event by dispatching a keydown event
      act(() => {
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        input.dispatchEvent(enterEvent)
      })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'title',
        value: expect.any(String),
      })
    })

    it('pressing Escape cancels title edit without calling onEdit', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const titleEl = container.querySelector('[data-edit-field="title"]') as HTMLElement
      act(() => { titleEl.click() })
      await flushPromises()

      const input = container.querySelector('[data-edit-input="title"]') as HTMLInputElement
      expect(input).not.toBeNull()

      act(() => {
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        input.dispatchEvent(escEvent)
      })
      await flushPromises()

      // Input should be gone, title span should be back
      expect(container.querySelector('[data-edit-input="title"]')).toBeNull()
      const titleSpan = container.querySelector('[data-edit-field="title"]') as HTMLElement
      expect(titleSpan).not.toBeNull()
      expect(onEdit).not.toHaveBeenCalled()
    })

    it('does not enter edit mode when onEdit is not provided', async () => {
      ;({ container, cleanup } = mountCard(makeTask()))
      await flushPromises()

      const titleEl = container.querySelector('[data-edit-field="title"]') as HTMLElement
      expect(titleEl).not.toBeNull()

      act(() => { titleEl.click() })
      await flushPromises()

      // No input should appear
      expect(container.querySelector('[data-edit-input="title"]')).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Status editing
  // -----------------------------------------------------------------------

  describe('status field', () => {
    it('clicking status badge shows dropdown when onEdit is provided', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const statusEl = container.querySelector('[data-edit-field="status"]') as HTMLElement
      expect(statusEl).not.toBeNull()

      act(() => { statusEl.click() })
      await flushPromises()

      const dropdown = container.querySelector('[data-edit-dropdown="status"]')
      expect(dropdown).not.toBeNull()
    })

    it('selecting a status option calls onEdit with the new status', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask({ status: 'todo' }), onEdit))
      await flushPromises()

      const statusEl = container.querySelector('[data-edit-field="status"]') as HTMLElement
      act(() => { statusEl.click() })
      await flushPromises()

      const doneOption = container.querySelector('[data-status-option="done"]') as HTMLElement
      expect(doneOption).not.toBeNull()

      act(() => { doneOption.click() })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'status',
        value: 'done',
      })
    })

    it('selecting in-progress calls onEdit with in-progress', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask({ status: 'todo' }), onEdit))
      await flushPromises()

      const statusEl = container.querySelector('[data-edit-field="status"]') as HTMLElement
      act(() => { statusEl.click() })
      await flushPromises()

      const option = container.querySelector('[data-status-option="in-progress"]') as HTMLElement
      act(() => { option.click() })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'status',
        value: 'in-progress',
      })
    })

    it('dropdown does not appear when onEdit is not provided', async () => {
      ;({ container, cleanup } = mountCard(makeTask()))
      await flushPromises()

      // When no onEdit, status badge is rendered without the wrapper span
      const statusDropdown = container.querySelector('[data-edit-dropdown="status"]')
      expect(statusDropdown).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Priority editing
  // -----------------------------------------------------------------------

  describe('priority field', () => {
    it('clicking priority flag shows priority dropdown', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask({ priority: 'medium' }), onEdit))
      await flushPromises()

      const priorityEl = container.querySelector('[data-edit-field="priority"]') as HTMLElement
      expect(priorityEl).not.toBeNull()

      act(() => { priorityEl.click() })
      await flushPromises()

      const dropdown = container.querySelector('[data-edit-dropdown="priority"]')
      expect(dropdown).not.toBeNull()
    })

    it('selecting a priority calls onEdit with new priority', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask({ priority: 'low' }), onEdit))
      await flushPromises()

      const priorityEl = container.querySelector('[data-edit-field="priority"]') as HTMLElement
      act(() => { priorityEl.click() })
      await flushPromises()

      const criticalOption = container.querySelector('[data-priority-option="critical"]') as HTMLElement
      expect(criticalOption).not.toBeNull()

      act(() => { criticalOption.click() })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'priority',
        value: 'critical',
      })
    })

    it('all priority options are shown in the dropdown', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const priorityEl = container.querySelector('[data-edit-field="priority"]') as HTMLElement
      act(() => { priorityEl.click() })
      await flushPromises()

      const options = ['low', 'medium', 'high', 'critical']
      for (const opt of options) {
        expect(container.querySelector(`[data-priority-option="${opt}"]`)).not.toBeNull()
      }
    })
  })

  // -----------------------------------------------------------------------
  // Checklist toggle
  // -----------------------------------------------------------------------

  describe('checklist toggle', () => {
    it('clicking unchecked item calls onEdit with checked=true', async () => {
      const onEdit = vi.fn()
      const data = makeTask({
        checklist: [
          { text: 'First item', checked: false },
          { text: 'Second item', checked: true },
        ],
      })
      ;({ container, cleanup } = mountCard(data, onEdit))
      await flushPromises()

      // Use data-checklist-row attribute to find the exact row
      const row0 = container.querySelector('[data-checklist-row="0"]') as HTMLElement
      expect(row0).not.toBeNull()

      act(() => { row0.click() })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'checklist.0.checked',
        value: true,
      })
    })

    it('clicking checked item calls onEdit with checked=false', async () => {
      const onEdit = vi.fn()
      const data = makeTask({
        checklist: [
          { text: 'First item', checked: false },
          { text: 'Second item', checked: true },
        ],
      })
      ;({ container, cleanup } = mountCard(data, onEdit))
      await flushPromises()

      const row1 = container.querySelector('[data-checklist-row="1"]') as HTMLElement
      expect(row1).not.toBeNull()

      act(() => { row1.click() })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'checklist.1.checked',
        value: false,
      })
    })

    it('checklist rows are not clickable when onEdit is not provided', async () => {
      const data = makeTask({
        checklist: [{ text: 'Step one', checked: false }],
      })
      ;({ container, cleanup } = mountCard(data))
      await flushPromises()

      const row0 = container.querySelector('[data-checklist-row="0"]') as HTMLElement
      expect(row0).not.toBeNull()
      // cursor should be 'default' when no onEdit
      expect(row0.style.cursor).toBe('default')
    })
  })

  // -----------------------------------------------------------------------
  // Description editing
  // -----------------------------------------------------------------------

  describe('description field', () => {
    it('clicking description text enters edit mode', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const descEl = container.querySelector('[data-edit-field="description"]') as HTMLElement
      expect(descEl).not.toBeNull()

      act(() => { descEl.click() })
      await flushPromises()

      const textarea = container.querySelector('[data-edit-input="description"]') as HTMLTextAreaElement
      expect(textarea).not.toBeNull()
      expect(textarea.value).toBe('A short description')
    })

    it('Ctrl+Enter in description textarea calls onEdit', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const descEl = container.querySelector('[data-edit-field="description"]') as HTMLElement
      act(() => { descEl.click() })
      await flushPromises()

      const textarea = container.querySelector('[data-edit-input="description"]') as HTMLTextAreaElement
      act(() => {
        const ctrlEnter = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
        textarea.dispatchEvent(ctrlEnter)
      })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'description',
        value: expect.any(String),
      })
    })

    it('Escape in description textarea cancels without calling onEdit', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const descEl = container.querySelector('[data-edit-field="description"]') as HTMLElement
      act(() => { descEl.click() })
      await flushPromises()

      const textarea = container.querySelector('[data-edit-input="description"]') as HTMLTextAreaElement
      act(() => {
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        textarea.dispatchEvent(escEvent)
      })
      await flushPromises()

      expect(container.querySelector('[data-edit-input="description"]')).toBeNull()
      expect(onEdit).not.toHaveBeenCalled()
    })

    it('description is not clickable in read-only mode', async () => {
      ;({ container, cleanup } = mountCard(makeTask()))
      await flushPromises()

      const descEl = container.querySelector('[data-edit-field="description"]') as HTMLElement
      expect(descEl).not.toBeNull()
      // cursor should not be 'text' in read-only mode
      expect(descEl.style.cursor).not.toBe('text')

      act(() => { descEl.click() })
      await flushPromises()

      expect(container.querySelector('[data-edit-input="description"]')).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Notes editing
  // -----------------------------------------------------------------------

  describe('notes field', () => {
    it('clicking notes text enters edit mode', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const notesEl = container.querySelector('[data-edit-field="notes"]') as HTMLElement
      expect(notesEl).not.toBeNull()

      act(() => { notesEl.click() })
      await flushPromises()

      const textarea = container.querySelector('[data-edit-input="notes"]') as HTMLTextAreaElement
      expect(textarea).not.toBeNull()
      expect(textarea.value).toBe('Some notes here')
    })

    it('Ctrl+Enter in notes textarea calls onEdit', async () => {
      const onEdit = vi.fn()
      ;({ container, cleanup } = mountCard(makeTask(), onEdit))
      await flushPromises()

      const notesEl = container.querySelector('[data-edit-field="notes"]') as HTMLElement
      act(() => { notesEl.click() })
      await flushPromises()

      const textarea = container.querySelector('[data-edit-input="notes"]') as HTMLTextAreaElement
      act(() => {
        const ctrlEnter = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
        textarea.dispatchEvent(ctrlEnter)
      })
      await flushPromises()

      expect(onEdit).toHaveBeenCalledWith({
        blockType: 'task',
        field: 'notes',
        value: expect.any(String),
      })
    })
  })
})
