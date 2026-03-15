import { describe, it, expect, beforeEach } from 'vitest'
import { blockRegistry } from '../../src/blocks/registry'
import { registerCoreBlocks } from '../../src/blocks/core'
import { validateBlockYaml } from '../../src/blocks/validation'
import { parseMarkdownBlocks } from '../../src/blocks/markdown'
import {
  registerKanbanBlock,
  kanbanBlockDefinition,
} from '../../src/plugins/kanban'
import type { KanbanData } from '../../src/plugins/kanban/types'

beforeEach(() => {
  blockRegistry.clear()
  registerCoreBlocks()
  registerKanbanBlock()
})

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe('validateBlockYaml — kanban blocks', () => {
  it('parses a full kanban block', () => {
    const source = [
      'title: Sprint 23',
      'group-by: status',
      'tasks:',
      '  - id: task-1',
      '    title: Fix login bug',
      '    status: done',
      '    priority: high',
      '  - id: task-2',
      '    title: Add dark mode',
      '    status: in-progress',
      '    priority: medium',
      '  - id: task-3',
      '    title: Write tests',
      '    status: todo',
      '    priority: low',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as KanbanData
    expect(data.title).toBe('Sprint 23')
    expect(data.groupBy).toBe('status')
    expect(data.tasks).toHaveLength(3)

    expect(data.tasks[0]).toEqual({ id: 'task-1', title: 'Fix login bug', status: 'done', priority: 'high' })
    expect(data.tasks[1]).toEqual({ id: 'task-2', title: 'Add dark mode', status: 'in-progress', priority: 'medium' })
    expect(data.tasks[2]).toEqual({ id: 'task-3', title: 'Write tests', status: 'todo', priority: 'low' })
  })

  it('defaults group-by to "status" when omitted', () => {
    const source = [
      'tasks:',
      '  - id: t1',
      '    title: Task One',
      '    status: todo',
      '    priority: high',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.groupBy).toBe('status')
  })

  it('accepts group-by: priority', () => {
    const source = [
      'group-by: priority',
      'tasks:',
      '  - id: t1',
      '    title: Critical Task',
      '    status: todo',
      '    priority: critical',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.groupBy).toBe('priority')
  })

  it('rejects invalid group-by value', () => {
    const source = [
      'group-by: assignee',
      'tasks:',
      '  - id: t1',
      '    title: Task',
      '    status: todo',
      '    priority: medium',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('assignee')
    expect(result.data).toBeNull()
  })

  it('rejects missing tasks list', () => {
    const source = [
      'title: Empty Board',
      'group-by: status',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('tasks')
    expect(result.data).toBeNull()
  })

  it('title is optional', () => {
    const source = [
      'tasks:',
      '  - id: t1',
      '    title: My Task',
      '    status: done',
      '    priority: low',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.title).toBeUndefined()
  })

  it('normalizes unknown status values to "todo"', () => {
    const source = [
      'tasks:',
      '  - id: t1',
      '    title: Unknown Status Task',
      '    status: wip',
      '    priority: medium',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.tasks[0].status).toBe('todo')
  })

  it('normalizes unknown priority values to "medium"', () => {
    const source = [
      'tasks:',
      '  - id: t1',
      '    title: Unknown Priority Task',
      '    status: done',
      '    priority: urgent',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.tasks[0].priority).toBe('medium')
  })

  it('normalizes in_progress with underscore to in-progress', () => {
    const source = [
      'tasks:',
      '  - id: t1',
      '    title: Task',
      '    status: in_progress',
      '    priority: high',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.tasks[0].status).toBe('in-progress')
  })

  it('generates task id from index when id is missing', () => {
    const source = [
      'tasks:',
      '  - title: No ID Task',
      '    status: todo',
      '    priority: medium',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.tasks[0].id).toBe('task-0')
  })

  it('handles empty tasks list', () => {
    const source = [
      'title: Empty',
      'tasks: []',
    ].join('\n')

    const result = validateBlockYaml('kanban', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as KanbanData
    expect(data.tasks).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('registry', () => {
  it('registers with type "kanban"', () => {
    expect(blockRegistry.has('kanban')).toBe(true)
    expect(blockRegistry.get('kanban')?.name).toBe('Kanban')
  })

  it('has inline and card components', () => {
    expect(kanbanBlockDefinition.components?.inline).toBeDefined()
    expect(kanbanBlockDefinition.components?.card).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Integration with parseMarkdownBlocks
// ---------------------------------------------------------------------------

describe('parseMarkdownBlocks integration', () => {
  it('extracts kanban blocks from markdown', () => {
    const md = [
      '# Board',
      '',
      '```kanban',
      'title: Sprint 23',
      'group-by: status',
      'tasks:',
      '  - id: task-1',
      '    title: Fix login bug',
      '    status: done',
      '    priority: high',
      '  - id: task-2',
      '    title: Add dark mode',
      '    status: in-progress',
      '    priority: medium',
      '```',
      '',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'sprint.md')
    expect(result.errors).toHaveLength(0)
    expect(result.blocks).toHaveLength(1)

    const block = result.blocks[0]
    expect(block.type).toBe('kanban')
    expect(block.data).not.toBeNull()

    const data = block.data as KanbanData
    expect(data.title).toBe('Sprint 23')
    expect(data.groupBy).toBe('status')
    expect(data.tasks).toHaveLength(2)
    expect(data.tasks[0].id).toBe('task-1')
    expect(data.tasks[0].status).toBe('done')
    expect(data.tasks[1].id).toBe('task-2')
    expect(data.tasks[1].status).toBe('in-progress')
  })

  it('extracts a kanban block with tilde fence', () => {
    const md = [
      '~~~kanban',
      'group-by: priority',
      'tasks:',
      '  - id: t1',
      '    title: Urgent Fix',
      '    status: todo',
      '    priority: critical',
      '~~~',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'board.md')
    expect(result.errors).toHaveLength(0)
    expect(result.blocks).toHaveLength(1)

    const data = result.blocks[0].data as KanbanData
    expect(data.groupBy).toBe('priority')
    expect(data.tasks[0].priority).toBe('critical')
  })

  it('preserves source information for kanban blocks', () => {
    const md = [
      '# Title',
      '',
      '```kanban',
      'tasks:',
      '  - id: t1',
      '    title: Task',
      '    status: todo',
      '    priority: low',
      '```',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'sourced.md')
    expect(result.blocks).toHaveLength(1)

    const source = result.blocks[0].source
    expect(source.filePath).toBe('sourced.md')
    expect(source.range.startLine).toBeGreaterThan(0)
    expect(source.range.endLine).toBeGreaterThan(0)
    expect(source.raw).toContain('```kanban')
  })

  it('reports errors for invalid kanban blocks in markdown', () => {
    const md = [
      '```kanban',
      'title: No Tasks Here',
      'group-by: status',
      '```',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'bad.md')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].data).toBeNull()
    expect(result.blocks[0].errors).toBeDefined()
    expect(result.blocks[0].errors!.length).toBeGreaterThan(0)
  })
})
