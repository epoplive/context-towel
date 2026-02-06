import { describe, expect, it, beforeEach } from 'vitest'
import { blockRegistry } from '../blocks/registry'
import { registerTaskBlock, taskBlockDefinition } from '../plugins/task'
import type { TaskData } from '../plugins/task/types'
import type { BlockInstance } from '../blocks/types'

describe('task block plugin', () => {
  beforeEach(() => {
    blockRegistry.clear()
  })

  it('registers with type "task"', () => {
    registerTaskBlock()
    expect(blockRegistry.has('task')).toBe(true)
    expect(blockRegistry.get('task')?.name).toBe('Task')
  })

  it('has inline and card components', () => {
    expect(taskBlockDefinition.components?.inline).toBeDefined()
    expect(taskBlockDefinition.components?.card).toBeDefined()
  })

  it('generates context markdown', () => {
    const blocks: BlockInstance<TaskData>[] = [
      {
        type: 'task',
        data: {
          id: 'task-1',
          title: 'Build feature',
          status: 'in-progress',
          priority: 'high',
          blockedBy: [],
          blocks: [],
          tags: ['#core'],
          description: '',
          checklist: [
            { text: 'Step 1', checked: true },
            { text: 'Step 2', checked: false },
          ],
          log: [],
          notes: '',
          progress: 50,
        },
        source: { filePath: 'plan.md', range: { startOffset: null, endOffset: null, startLine: 1, endLine: 10 }, raw: '' },
      },
      {
        type: 'task',
        data: {
          id: 'task-2',
          title: 'Write docs',
          status: 'done',
          priority: 'low',
          blockedBy: [],
          blocks: [],
          tags: [],
          description: '',
          checklist: [],
          log: [],
          notes: '',
          progress: 100,
        },
        source: { filePath: 'plan.md', range: { startOffset: null, endOffset: null, startLine: 12, endLine: 20 }, raw: '' },
      },
    ]

    const md = taskBlockDefinition.toContextMarkdown!(blocks)
    expect(md).toContain('### Tasks')
    expect(md).toContain('- [ ] **Build feature** (in-progress) 50%')
    expect(md).toContain('- [x] **Write docs** (done)')
  })
})
