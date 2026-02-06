import { describe, expect, it } from 'vitest'
import type { TaskItem } from './types'
import { buildTaskBoardGroups, getTaskBoardDragUpdate } from './components'

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

describe('TaskBoard grouping', () => {
  it('orders status groups using the configured status order', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'done', sourceLine: 20 }),
      makeTask({ id: 'b', status: 'todo', sourceLine: 5 }),
      makeTask({ id: 'c', status: 'blocked', sourceLine: 10 }),
    ]

    const grouped = buildTaskBoardGroups(tasks, 'status')
    expect(grouped?.orderedKeys).toEqual(['todo', 'blocked', 'done'])
    expect(grouped?.groups.get('todo')?.map(task => task.id)).toEqual(['b'])
    expect(grouped?.groups.get('blocked')?.map(task => task.id)).toEqual(['c'])
    expect(grouped?.groups.get('done')?.map(task => task.id)).toEqual(['a'])
  })

  it('sorts tasks within a group by source line', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'todo', sourceLine: 20 }),
      makeTask({ id: 'b', status: 'todo', sourceLine: 5 }),
      makeTask({ id: 'c', status: 'todo', sourceLine: 10 }),
    ]

    const grouped = buildTaskBoardGroups(tasks, 'status')
    expect(grouped?.groups.get('todo')?.map(task => task.id)).toEqual(['b', 'c', 'a'])
  })

  it('orders priority groups using the configured priority order', () => {
    const tasks = [
      makeTask({ id: 'a', priority: 'low' }),
      makeTask({ id: 'b', priority: 'critical' }),
      makeTask({ id: 'c', priority: 'high' }),
    ]

    const grouped = buildTaskBoardGroups(tasks, 'priority')
    expect(grouped?.orderedKeys).toEqual(['critical', 'high', 'low'])
  })
})

describe('TaskBoard drag semantics', () => {
  it('returns a status update when dropping into a new status column', () => {
    const task = makeTask({ id: 'a', status: 'todo' })
    const update = getTaskBoardDragUpdate('status', task, 'status', 'done')
    expect(update).toEqual({ status: 'done' })
  })

  it('returns a priority update when dropping into a new priority column', () => {
    const task = makeTask({ id: 'a', priority: 'low' })
    const update = getTaskBoardDragUpdate('priority', task, 'priority', 'high')
    expect(update).toEqual({ priority: 'high' })
  })

  it('returns null when groupBy does not match or value is unchanged', () => {
    const task = makeTask({ id: 'a', status: 'todo', priority: 'medium' })
    expect(getTaskBoardDragUpdate('status', task, 'priority', 'high')).toBeNull()
    expect(getTaskBoardDragUpdate('status', task, 'status', 'todo')).toBeNull()
  })
})
