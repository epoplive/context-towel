import { describe, it, expect, beforeEach } from 'vitest'
import { registerTaskBlock } from '@context-towel/card-library'
import { createMockFs } from './helpers'
import {
  serializeTaskBlock,
  findTaskBlockById,
  extractTaskBlocks,
  buildTaskSourceMap,
  syncTaskToSourceFile,
} from '../../src/task-sync'
import type { TaskSyncData } from '../../src/task-sync'
import { PacketManager } from '../../src/PacketManager'

// Register task block so parseMarkdownBlocks recognizes ~~~task blocks
registerTaskBlock()

const samplePlanFile = `# My Plan

## Phase 1: Setup
Status: todo

~~~task
id: setup-db
title: Set up database
status: todo
priority: high
description: |
  Create the database schema.
checklist:
  - [ ] Create migrations
  - [ ] Run seeds
~~~

~~~task
id: setup-auth
title: Set up auth middleware
status: todo
priority: critical
blocked-by: [[setup-db]]
description: |
  JWT middleware for API routes.
~~~

## Phase 2: Implementation
Status: todo

~~~task
id: impl-api
title: Implement API endpoints
status: todo
priority: high
blocked-by: [[setup-auth]]
description: |
  REST endpoints for the app.
~~~
`

describe('serializeTaskBlock', () => {
  it('serializes a basic task', () => {
    const task: TaskSyncData = {
      id: 'my-task',
      title: 'My Task',
      status: 'todo',
      priority: 'high',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: '',
      checklist: [],
      log: [],
      notes: '',
    }

    const result = serializeTaskBlock(task)
    expect(result).toContain('id: my-task')
    expect(result).toContain('title: My Task')
    expect(result).toContain('status: todo')
    expect(result).toContain('priority: high')
  })

  it('serializes checklist items', () => {
    const task: TaskSyncData = {
      id: 'checklist-task',
      title: 'Task with checklist',
      status: 'in-progress',
      priority: 'medium',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: '',
      checklist: [
        { text: 'Step 1', checked: true },
        { text: 'Step 2', checked: false },
      ],
      log: [],
      notes: '',
    }

    const result = serializeTaskBlock(task)
    expect(result).toContain('checklist:')
    expect(result).toContain('  - [x] Step 1')
    expect(result).toContain('  - [ ] Step 2')
  })

  it('serializes blocked-by and blocks', () => {
    const task: TaskSyncData = {
      id: 'linked-task',
      title: 'Linked Task',
      status: 'blocked',
      priority: 'high',
      blockedBy: ['other-task', 'another'],
      blocks: ['downstream'],
      tags: [],
      description: '',
      checklist: [],
      log: [],
      notes: '',
    }

    const result = serializeTaskBlock(task)
    expect(result).toContain('blocked-by: [[other-task]], [[another]]')
    expect(result).toContain('blocks: [[downstream]]')
  })

  it('serializes description and notes as block scalars', () => {
    const task: TaskSyncData = {
      id: 'desc-task',
      title: 'Descriptive',
      status: 'todo',
      priority: 'medium',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: 'Line one\nLine two',
      checklist: [],
      log: [],
      notes: 'A note\nWith lines',
    }

    const result = serializeTaskBlock(task)
    expect(result).toContain('description: |')
    expect(result).toContain('  Line one')
    expect(result).toContain('  Line two')
    expect(result).toContain('notes: |')
    expect(result).toContain('  A note')
  })

  it('serializes log entries', () => {
    const task: TaskSyncData = {
      id: 'log-task',
      title: 'Logged',
      status: 'done',
      priority: 'low',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: '',
      checklist: [],
      log: [
        { timestamp: '2026-03-01', entry: 'Started work' },
        { timestamp: '2026-03-02', entry: 'Completed' },
      ],
      notes: '',
    }

    const result = serializeTaskBlock(task)
    expect(result).toContain('log:')
    expect(result).toContain('  - [2026-03-01] Started work')
    expect(result).toContain('  - [2026-03-02] Completed')
  })

  it('serializes tags', () => {
    const task: TaskSyncData = {
      id: 'tagged',
      title: 'Tagged Task',
      status: 'todo',
      priority: 'medium',
      blockedBy: [],
      blocks: [],
      tags: ['auth', 'backend'],
      description: '',
      checklist: [],
      log: [],
      notes: '',
    }

    const result = serializeTaskBlock(task)
    expect(result).toContain('tags: #auth #backend')
  })

  it('omits optional empty fields', () => {
    const task: TaskSyncData = {
      id: 'minimal',
      title: 'Minimal',
      status: 'todo',
      priority: 'medium',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: '',
      checklist: [],
      log: [],
      notes: '',
    }

    const result = serializeTaskBlock(task)
    expect(result).not.toContain('category:')
    expect(result).not.toContain('owner:')
    expect(result).not.toContain('active-form:')
    expect(result).not.toContain('blocked-by:')
    expect(result).not.toContain('tags:')
    expect(result).not.toContain('description:')
    expect(result).not.toContain('checklist:')
    expect(result).not.toContain('log:')
    expect(result).not.toContain('notes:')
  })
})

describe('findTaskBlockById', () => {
  it('finds a task block by ID', () => {
    const block = findTaskBlockById(samplePlanFile, 'plan.md', 'setup-db')
    expect(block).not.toBeNull()
    expect(block!.type).toBe('task')
    expect((block!.data as any).id).toBe('setup-db')
  })

  it('returns null for non-existent task', () => {
    const block = findTaskBlockById(samplePlanFile, 'plan.md', 'nonexistent')
    expect(block).toBeNull()
  })
})

describe('extractTaskBlocks', () => {
  it('extracts all task blocks with IDs', () => {
    const tasks = extractTaskBlocks(samplePlanFile, 'plan.md')
    expect(tasks).toHaveLength(3)
    expect(tasks.map(t => t.taskId)).toEqual(['setup-db', 'setup-auth', 'impl-api'])
  })
})

describe('buildTaskSourceMap', () => {
  it('maps all task IDs to the source file', () => {
    const map = buildTaskSourceMap(samplePlanFile, '/project/plan.md')
    expect(map).toEqual({
      'setup-db': '/project/plan.md',
      'setup-auth': '/project/plan.md',
      'impl-api': '/project/plan.md',
    })
  })
})

describe('syncTaskToSourceFile', () => {
  let fs: ReturnType<typeof createMockFs>

  beforeEach(() => {
    fs = createMockFs()
  })

  it('updates a task status in the source file', async () => {
    await fs.write('/plan.md', samplePlanFile)

    const result = await syncTaskToSourceFile(fs, '/plan.md', 'setup-db', {
      id: 'setup-db',
      title: 'Set up database',
      status: 'done',
      priority: 'high',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: 'Create the database schema.',
      checklist: [
        { text: 'Create migrations', checked: true },
        { text: 'Run seeds', checked: true },
      ],
      log: [],
      notes: '',
    })

    expect(result.success).toBe(true)

    const updated = await fs.read('/plan.md')
    // Verify the task was updated
    expect(updated).toContain('status: done')
    // Verify checklist items were updated
    expect(updated).toContain('[x] Create migrations')
    expect(updated).toContain('[x] Run seeds')
    // Verify other tasks are untouched
    expect(updated).toContain('id: setup-auth')
    expect(updated).toContain('id: impl-api')
  })

  it('returns error for missing task', async () => {
    await fs.write('/plan.md', samplePlanFile)

    const result = await syncTaskToSourceFile(fs, '/plan.md', 'nonexistent', {
      id: 'nonexistent',
      title: 'Nope',
      status: 'todo',
      priority: 'low',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: '',
      checklist: [],
      log: [],
      notes: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns error for missing file', async () => {
    const result = await syncTaskToSourceFile(fs, '/missing.md', 'setup-db', {
      id: 'setup-db',
      title: 'X',
      status: 'todo',
      priority: 'low',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: '',
      checklist: [],
      log: [],
      notes: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Cannot read')
  })
})

describe('PacketManager.createFromPlanFile', () => {
  let fs: ReturnType<typeof createMockFs>
  let manager: PacketManager

  beforeEach(() => {
    fs = createMockFs()
    manager = new PacketManager('/packets', fs)
  })

  it('creates a packet with tasks seeded from plan file', async () => {
    await fs.write('/project/plan.md', samplePlanFile)

    const path = await manager.createFromPlanFile('auth-system', '/project/plan.md')
    expect(path).toBe('/packets/auth-system.md')

    const content = await manager.load('auth-system')
    expect(content).not.toBeNull()
    // Should contain seeded task blocks
    expect(content).toContain('id: setup-db')
    expect(content).toContain('id: setup-auth')
    expect(content).toContain('id: impl-api')
  })

  it('tracks task sources in metadata', async () => {
    await fs.write('/project/plan.md', samplePlanFile)

    await manager.createFromPlanFile('auth-system', '/project/plan.md')

    const source = await manager.getTaskSource('auth-system', 'setup-db')
    expect(source).toBe('/project/plan.md')

    const source2 = await manager.getTaskSource('auth-system', 'setup-auth')
    expect(source2).toBe('/project/plan.md')
  })

  it('stores planFileRef in metadata', async () => {
    await fs.write('/project/plan.md', samplePlanFile)

    await manager.createFromPlanFile('auth-system', '/project/plan.md')

    const packets = await manager.list()
    expect(packets[0].planFileRef).toBe('/project/plan.md')
  })
})

describe('PacketManager.syncTaskToSource', () => {
  let fs: ReturnType<typeof createMockFs>
  let manager: PacketManager

  beforeEach(async () => {
    fs = createMockFs()
    manager = new PacketManager('/packets', fs)
    await fs.write('/project/plan.md', samplePlanFile)
    await manager.createFromPlanFile('auth-system', '/project/plan.md')
  })

  it('syncs task status change back to plan file', async () => {
    const result = await manager.syncTaskToSource('auth-system', 'setup-db', {
      id: 'setup-db',
      title: 'Set up database',
      status: 'done',
      priority: 'high',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: 'Create the database schema.',
      checklist: [
        { text: 'Create migrations', checked: true },
        { text: 'Run seeds', checked: true },
      ],
      log: [],
      notes: '',
    })

    expect(result.success).toBe(true)

    // Verify the plan file was updated
    const planContent = await fs.read('/project/plan.md')
    expect(planContent).toContain('status: done')
    expect(planContent).toContain('[x] Create migrations')
  })

  it('returns error for untracked task', async () => {
    const result = await manager.syncTaskToSource('auth-system', 'unknown-task', {
      id: 'unknown-task',
      title: 'X',
      status: 'todo',
      priority: 'low',
      blockedBy: [],
      blocks: [],
      tags: [],
      description: '',
      checklist: [],
      log: [],
      notes: '',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('No source file tracked')
  })
})
