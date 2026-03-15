import { describe, it, expect, beforeEach } from 'vitest'
import { blockRegistry } from '../../../blocks/registry'
import { registerCoreBlocks } from '../../../blocks/core'
import { validateBlockYaml } from '../../../blocks/validation'
import { registerDependencyGraphBlock, dependencyGraphBlockDefinition } from '../index'
import { computeDepGraphLayout, getDependencyChain, hasCycleInGraph } from '../layout'
import type { DepGraphTask } from '../types'

// ---------------------------------------------------------------------------
// Parsing tests
// ---------------------------------------------------------------------------

describe('dependency-graph block parsing', () => {
  beforeEach(() => {
    blockRegistry.clear()
    registerCoreBlocks()
    registerDependencyGraphBlock()
  })

  it('parses minimal block with tasks list', () => {
    const yaml = `
tasks:
  - id: auth-1
    title: Design auth flow
    status: done
  - id: auth-2
    title: Implement JWT
    status: in-progress
    blocked-by: [auth-1]
`.trim()

    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors).toHaveLength(0)
    const data = result.data as { title?: string; tasks: DepGraphTask[] }
    expect(data).not.toBeNull()
    expect(data.tasks).toHaveLength(2)
    expect(data.tasks[0].id).toBe('auth-1')
    expect(data.tasks[0].status).toBe('done')
    expect(data.tasks[0].blockedBy).toHaveLength(0)
    expect(data.tasks[1].id).toBe('auth-2')
    expect(data.tasks[1].status).toBe('in-progress')
    expect(data.tasks[1].blockedBy).toEqual(['auth-1'])
  })

  it('parses optional title', () => {
    const yaml = `
title: Sprint Dependencies
tasks:
  - id: t1
    title: Task One
    status: todo
`.trim()

    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors).toHaveLength(0)
    const data = result.data as { title?: string; tasks: DepGraphTask[] }
    expect(data.title).toBe('Sprint Dependencies')
  })

  it('parses priority field', () => {
    const yaml = `
tasks:
  - id: t1
    title: Critical task
    status: todo
    priority: critical
`.trim()

    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors).toHaveLength(0)
    const data = result.data as { tasks: DepGraphTask[] }
    expect(data.tasks[0].priority).toBe('critical')
  })

  it('defaults invalid status to todo', () => {
    const yaml = `
tasks:
  - id: t1
    title: Task
    status: in_progress
`.trim()

    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors).toHaveLength(0)
    // in_progress normalizes to in-progress
    const data = result.data as { tasks: DepGraphTask[] }
    expect(data.tasks[0].status).toBe('in-progress')
  })

  it('accepts blocked-by as comma-separated string', () => {
    const yaml = `
tasks:
  - id: t1
    title: Task One
    status: done
  - id: t2
    title: Task Two
    status: todo
    blocked-by: "t1"
`.trim()

    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors).toHaveLength(0)
    const data = result.data as { tasks: DepGraphTask[] }
    expect(data.tasks[1].blockedBy).toEqual(['t1'])
  })

  it('returns error when tasks field is missing', () => {
    const yaml = `title: No tasks here`
    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toBeNull()
  })

  it('returns error for invalid YAML', () => {
    const yaml = `tasks: [unclosed`
    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toBeNull()
  })

  it('handles full example from block format spec', () => {
    const yaml = `
title: Sprint Dependencies
tasks:
  - id: auth-1
    title: Design auth flow
    status: done
  - id: auth-2
    title: Implement JWT
    status: in-progress
    blocked-by: [auth-1]
  - id: auth-3
    title: Add refresh tokens
    status: todo
    blocked-by: [auth-2]
  - id: auth-4
    title: Write auth tests
    status: todo
    blocked-by: [auth-2, auth-3]
`.trim()

    const result = validateBlockYaml('dependency-graph', yaml)
    expect(result.errors).toHaveLength(0)
    const data = result.data as { title?: string; tasks: DepGraphTask[] }
    expect(data.title).toBe('Sprint Dependencies')
    expect(data.tasks).toHaveLength(4)
    expect(data.tasks[3].blockedBy).toEqual(['auth-2', 'auth-3'])
  })
})

// ---------------------------------------------------------------------------
// Plugin registration tests
// ---------------------------------------------------------------------------

describe('dependency-graph plugin registration', () => {
  beforeEach(() => {
    blockRegistry.clear()
  })

  it('registers with type "dependency-graph"', () => {
    registerDependencyGraphBlock()
    expect(blockRegistry.has('dependency-graph')).toBe(true)
    expect(blockRegistry.get('dependency-graph')?.name).toBe('Dependency Graph')
  })

  it('has card and inline components', () => {
    expect(dependencyGraphBlockDefinition.components?.card).toBeDefined()
    expect(dependencyGraphBlockDefinition.components?.inline).toBeDefined()
  })

  it('replaces core stub on registerOrReplace', () => {
    registerCoreBlocks()
    // Core registered stub without components
    const stub = blockRegistry.get('dependency-graph')
    expect(stub?.components).toBeUndefined()

    registerDependencyGraphBlock()
    const full = blockRegistry.get('dependency-graph')
    expect(full?.components?.card).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Topological sort / layout tests
// ---------------------------------------------------------------------------

describe('topological sort (computeDepGraphLayout)', () => {
  it('assigns root nodes (no deps) to column 0', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: [] },
      { id: 'b', title: 'B', status: 'todo', blockedBy: [] },
    ]
    const layout = computeDepGraphLayout({ tasks })
    const nodeA = layout.nodeMap.get('a')
    const nodeB = layout.nodeMap.get('b')
    expect(nodeA?.col).toBe(0)
    expect(nodeB?.col).toBe(0)
  })

  it('assigns dependent nodes to later columns', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: [] },
      { id: 'b', title: 'B', status: 'in-progress', blockedBy: ['a'] },
      { id: 'c', title: 'C', status: 'todo', blockedBy: ['b'] },
    ]
    const layout = computeDepGraphLayout({ tasks })
    expect(layout.nodeMap.get('a')?.col).toBe(0)
    expect(layout.nodeMap.get('b')?.col).toBe(1)
    expect(layout.nodeMap.get('c')?.col).toBe(2)
  })

  it('builds correct edges', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: [] },
      { id: 'b', title: 'B', status: 'todo', blockedBy: ['a'] },
    ]
    const layout = computeDepGraphLayout({ tasks })
    expect(layout.edges).toHaveLength(1)
    expect(layout.edges[0].sourceId).toBe('a')
    expect(layout.edges[0].targetId).toBe('b')
  })

  it('handles a diamond dependency pattern', () => {
    // a -> b -> d
    // a -> c -> d
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: [] },
      { id: 'b', title: 'B', status: 'done', blockedBy: ['a'] },
      { id: 'c', title: 'C', status: 'in-progress', blockedBy: ['a'] },
      { id: 'd', title: 'D', status: 'todo', blockedBy: ['b', 'c'] },
    ]
    const layout = computeDepGraphLayout({ tasks })
    expect(layout.nodeMap.get('a')?.col).toBe(0)
    expect(layout.nodeMap.get('b')?.col).toBe(1)
    expect(layout.nodeMap.get('c')?.col).toBe(1)
    expect(layout.nodeMap.get('d')?.col).toBe(2)
    expect(layout.edges).toHaveLength(4)
    expect(layout.hasCycle).toBe(false)
  })

  it('ignores deps that reference unknown task IDs', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: ['nonexistent'] },
    ]
    const layout = computeDepGraphLayout({ tasks })
    expect(layout.nodes).toHaveLength(1)
    expect(layout.edges).toHaveLength(0)
    expect(layout.nodeMap.get('a')?.col).toBe(0)
  })

  it('returns empty layout for empty task list', () => {
    const layout = computeDepGraphLayout({ tasks: [] })
    expect(layout.nodes).toHaveLength(0)
    expect(layout.edges).toHaveLength(0)
    expect(layout.totalWidth).toBe(0)
    expect(layout.totalHeight).toBe(0)
  })

  it('assigns non-negative pixel positions to all nodes', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: [] },
      { id: 'b', title: 'B', status: 'todo', blockedBy: ['a'] },
      { id: 'c', title: 'C', status: 'todo', blockedBy: ['a'] },
    ]
    const layout = computeDepGraphLayout({ tasks })
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.width).toBeGreaterThan(0)
      expect(node.height).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Cycle detection tests
// ---------------------------------------------------------------------------

describe('hasCycleInGraph', () => {
  it('returns false for a linear chain', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: [] },
      { id: 'b', title: 'B', status: 'todo', blockedBy: ['a'] },
    ]
    expect(hasCycleInGraph(tasks)).toBe(false)
  })

  it('returns false for isolated nodes', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: [] },
      { id: 'b', title: 'B', status: 'todo', blockedBy: [] },
    ]
    expect(hasCycleInGraph(tasks)).toBe(false)
  })

  it('detects a direct self-reference cycle', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'todo', blockedBy: ['a'] },
    ]
    expect(hasCycleInGraph(tasks)).toBe(true)
  })

  it('detects a two-node cycle', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'todo', blockedBy: ['b'] },
      { id: 'b', title: 'B', status: 'todo', blockedBy: ['a'] },
    ]
    expect(hasCycleInGraph(tasks)).toBe(true)
  })

  it('detects a three-node cycle', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'todo', blockedBy: ['c'] },
      { id: 'b', title: 'B', status: 'todo', blockedBy: ['a'] },
      { id: 'c', title: 'C', status: 'todo', blockedBy: ['b'] },
    ]
    expect(hasCycleInGraph(tasks)).toBe(true)
  })

  it('returns false for empty task list', () => {
    expect(hasCycleInGraph([])).toBe(false)
  })

  it('ignores deps to unknown tasks (no false positive)', () => {
    const tasks: DepGraphTask[] = [
      { id: 'a', title: 'A', status: 'done', blockedBy: ['missing'] },
    ]
    expect(hasCycleInGraph(tasks)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Dependency chain detection tests
// ---------------------------------------------------------------------------

describe('getDependencyChain', () => {
  const tasks: DepGraphTask[] = [
    { id: 'auth-1', title: 'Design', status: 'done', blockedBy: [] },
    { id: 'auth-2', title: 'JWT', status: 'in-progress', blockedBy: ['auth-1'] },
    { id: 'auth-3', title: 'Refresh', status: 'todo', blockedBy: ['auth-2'] },
    { id: 'auth-4', title: 'Tests', status: 'todo', blockedBy: ['auth-2', 'auth-3'] },
    { id: 'unrelated', title: 'Other', status: 'todo', blockedBy: [] },
  ]

  it('includes the selected node itself', () => {
    const chain = getDependencyChain('auth-2', tasks)
    expect(chain.has('auth-2')).toBe(true)
  })

  it('includes all ancestors', () => {
    const chain = getDependencyChain('auth-3', tasks)
    expect(chain.has('auth-1')).toBe(true)
    expect(chain.has('auth-2')).toBe(true)
    expect(chain.has('auth-3')).toBe(true)
  })

  it('includes all descendants', () => {
    const chain = getDependencyChain('auth-2', tasks)
    expect(chain.has('auth-3')).toBe(true)
    expect(chain.has('auth-4')).toBe(true)
  })

  it('does not include unrelated nodes', () => {
    const chain = getDependencyChain('auth-2', tasks)
    expect(chain.has('unrelated')).toBe(false)
  })

  it('returns only itself for isolated node', () => {
    const chain = getDependencyChain('unrelated', tasks)
    expect(chain.size).toBe(1)
    expect(chain.has('unrelated')).toBe(true)
  })

  it('returns full chain for root node', () => {
    // auth-1 is the root — its descendants are auth-2, auth-3, auth-4
    const chain = getDependencyChain('auth-1', tasks)
    expect(chain.has('auth-1')).toBe(true)
    expect(chain.has('auth-2')).toBe(true)
    expect(chain.has('auth-3')).toBe(true)
    expect(chain.has('auth-4')).toBe(true)
    expect(chain.has('unrelated')).toBe(false)
  })
})
