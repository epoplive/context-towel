import { describe, it, expect } from 'vitest'
import { SessionTree, summarizeBranch } from '../../../src/memory/session-tree'
import type { ToolResultEntry, ToolCallEntry, CompactionEntry } from '../../../src/memory/session-tree'

describe('SessionTree', () => {
  describe('creation', () => {
    it('creates with a session id', () => {
      const tree = new SessionTree('test-session')
      expect(tree.sessionId).toBe('test-session')
      expect(tree.size).toBe(0)
      expect(tree.getLeaf()).toBeNull()
    })

    it('creates via static factory', () => {
      const tree = SessionTree.create('s1')
      expect(tree.sessionId).toBe('s1')
    })

    it('generates unique session id if not provided', () => {
      const tree = SessionTree.create()
      expect(tree.sessionId).toContain('session-')
    })
  })

  describe('append', () => {
    it('appends an entry and sets it as leaf', () => {
      const tree = SessionTree.create('s1')
      const entry = tree.appendMessage('Hello', 'user')

      expect(entry.id).toContain('s1')
      expect(entry.content).toBe('Hello')
      expect(entry.role).toBe('user')
      expect(entry.parentId).toBeNull() // First entry has no parent
      expect(tree.getLeaf()).toBe(entry)
    })

    it('chains entries linearly', () => {
      const tree = SessionTree.create('s1')
      const e1 = tree.appendMessage('Hello', 'user')
      const e2 = tree.appendMessage('Hi there', 'assistant')

      expect(e2.parentId).toBe(e1.id)
      expect(tree.getLeaf()).toBe(e2)
    })
  })

  describe('appendToolCall', () => {
    it('appends a tool call entry', () => {
      const tree = SessionTree.create('s1')
      const entry = tree.appendToolCall('read_file', { path: 'test.ts' })

      expect(entry.type).toBe('tool_call')
      expect(entry.role).toBe('assistant')
      expect((entry as ToolCallEntry).toolName).toBe('read_file')
      expect((entry as ToolCallEntry).toolArgs).toEqual({ path: 'test.ts' })
    })
  })

  describe('appendToolResult', () => {
    it('appends a tool result entry', () => {
      const tree = SessionTree.create('s1')
      tree.appendToolCall('bash', { command: 'ls' })
      const result = tree.appendToolResult('file1.ts\nfile2.ts', true, 50)

      expect(result.type).toBe('tool_result')
      expect(result.role).toBe('tool')
      expect((result as ToolResultEntry).success).toBe(true)
      expect((result as ToolResultEntry).durationMs).toBe(50)
    })
  })

  describe('branching', () => {
    it('branches from a specific entry', () => {
      const tree = SessionTree.create('s1')
      const e1 = tree.appendMessage('Hello', 'user')
      tree.appendMessage('Approach A', 'assistant')
      tree.appendMessage('That did not work', 'user')

      // Branch back to e1 (like trying a different approach)
      tree.branch(e1.id)
      const e4 = tree.appendMessage('Approach B', 'assistant')

      expect(e4.parentId).toBe(e1.id)
      // e1 now has two children
      const children = tree.getChildren(e1.id)
      expect(children).toHaveLength(2)
    })

    it('branches with summary injection', () => {
      const tree = SessionTree.create('s1')
      const e1 = tree.appendMessage('Hello', 'user')
      tree.appendMessage('Approach A', 'assistant')

      tree.branch(e1.id, 'Approach A failed because of X')

      // The leaf should now be the branch summary entry
      const leaf = tree.getLeaf()
      expect(leaf!.type).toBe('branch_summary')
      expect(leaf!.content).toBe('Approach A failed because of X')
    })

    it('branchFromParent creates sibling', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('Hello', 'user')
      tree.appendMessage('Response', 'assistant')

      tree.branchFromParent('Previous approach failed')

      const leaf = tree.getLeaf()
      expect(leaf!.type).toBe('branch_summary')
    })

    it('throws when branching from root with no parent', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('Only entry', 'user')

      expect(() => tree.branchFromParent()).toThrow('Cannot branch from root')
    })
  })

  describe('navigation', () => {
    it('getEntry returns entry by id', () => {
      const tree = SessionTree.create('s1')
      const e1 = tree.appendMessage('Hello', 'user')

      expect(tree.getEntry(e1.id)).toBe(e1)
      expect(tree.getEntry('nope')).toBeUndefined()
    })

    it('getPathTo returns path from root to entry', () => {
      const tree = SessionTree.create('s1')
      const e1 = tree.appendMessage('A', 'user')
      const e2 = tree.appendMessage('B', 'assistant')
      const e3 = tree.appendMessage('C', 'user')

      const path = tree.getPathTo(e3.id)
      expect(path).toHaveLength(3)
      expect(path[0]!.id).toBe(e1.id)
      expect(path[1]!.id).toBe(e2.id)
      expect(path[2]!.id).toBe(e3.id)
    })

    it('getContext returns path to current leaf', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('A', 'user')
      tree.appendMessage('B', 'assistant')
      tree.appendMessage('C', 'user')

      const context = tree.getContext()
      expect(context).toHaveLength(3)
    })

    it('getContext returns empty for empty tree', () => {
      const tree = SessionTree.create('s1')
      expect(tree.getContext()).toHaveLength(0)
    })

    it('getAllEntries returns all entries', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('A', 'user')
      tree.appendMessage('B', 'assistant')
      expect(tree.getAllEntries()).toHaveLength(2)
    })
  })

  describe('tree structure', () => {
    it('getTree returns tree nodes', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('Root', 'user')
      tree.appendMessage('Child', 'assistant')

      const nodes = tree.getTree()
      expect(nodes).toHaveLength(1) // One root
      expect(nodes[0]!.children).toHaveLength(1)
    })

    it('getLeaves returns leaf entries', () => {
      const tree = SessionTree.create('s1')
      const e1 = tree.appendMessage('Root', 'user')
      tree.appendMessage('Branch A', 'assistant')

      // Branch back to root
      tree.branch(e1.id)
      tree.appendMessage('Branch B', 'assistant')

      const leaves = tree.getLeaves()
      expect(leaves.length).toBeGreaterThanOrEqual(2)
    })

    it('getBranchPoints returns entries with multiple children', () => {
      const tree = SessionTree.create('s1')
      const e1 = tree.appendMessage('Root', 'user')
      tree.appendMessage('Branch A', 'assistant')

      tree.branch(e1.id)
      tree.appendMessage('Branch B', 'assistant')

      const branchPoints = tree.getBranchPoints()
      expect(branchPoints).toHaveLength(1)
      expect(branchPoints[0]!.id).toBe(e1.id)
    })
  })

  describe('compaction', () => {
    it('computes context tokens', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('Hello world', 'user') // ~3 tokens
      tree.appendMessage('Hi there', 'assistant') // ~2 tokens

      const tokens = tree.getContextTokens()
      expect(tokens).toBeGreaterThan(0)
    })

    it('detects when compaction is needed', () => {
      const tree = SessionTree.create('s1', { maxTokens: 10 })
      // Add enough content to exceed 10 tokens
      tree.appendMessage('A'.repeat(100), 'user')

      expect(tree.needsCompaction()).toBe(true)
    })

    it('compacts the context', () => {
      const tree = SessionTree.create('s1', { maxTokens: 50, targetTokensAfterCompaction: 20 })
      tree.appendMessage('First message that is somewhat long', 'user')
      tree.appendMessage('Second response that is also long', 'assistant')
      tree.appendMessage('Third message with more content', 'user')
      tree.appendMessage('Fourth response', 'assistant')

      const compacted = tree.compact('Summary of earlier conversation')
      expect(compacted.type).toBe('compaction')
      expect((compacted as CompactionEntry).summary).toBe('Summary of earlier conversation')
    })

    it('throws when not enough entries to compact', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('A', 'user')

      expect(() => tree.compact('summary')).toThrow('Not enough entries')
    })
  })

  describe('serialization', () => {
    it('serializes and deserializes to JSON-lines', () => {
      const tree = SessionTree.create('s1')
      tree.appendMessage('Hello', 'user')
      tree.appendMessage('Hi', 'assistant')
      tree.appendMessage('Thanks', 'user')

      const jsonLines = tree.toJsonLines()
      expect(typeof jsonLines).toBe('string')
      expect(jsonLines.split('\n').length).toBe(4) // 1 header + 3 entries

      const restored = SessionTree.fromJsonLines(jsonLines)
      expect(restored.sessionId).toBe('s1')
      expect(restored.size).toBe(3)
      expect(restored.getLeaf()!.content).toBe('Thanks')
    })

    it('throws for empty data', () => {
      expect(() => SessionTree.fromJsonLines('')).toThrow('Empty session data')
    })
  })
})

describe('summarizeBranch', () => {
  it('summarizes a branch with messages and tool calls', () => {
    const entries = [
      { id: '1', parentId: null, type: 'message' as const, timestamp: 0, content: 'Hello', role: 'user' as const, tokenEstimate: 2 },
      { id: '2', parentId: '1', type: 'tool_call' as const, timestamp: 1, content: 'read_file()', role: 'assistant' as const, tokenEstimate: 3 },
      { id: '3', parentId: '2', type: 'tool_result' as const, timestamp: 2, content: 'file content', role: 'tool' as const, tokenEstimate: 3, success: true, durationMs: 50 },
      { id: '4', parentId: '3', type: 'message' as const, timestamp: 3, content: 'I found the bug', role: 'assistant' as const, tokenEstimate: 4 },
    ]

    const summary = summarizeBranch(entries)
    expect(summary).toContain('2 messages')
    expect(summary).toContain('1 tool calls')
    expect(summary).toContain('I found the bug')
  })

  it('handles empty branch', () => {
    const summary = summarizeBranch([])
    expect(summary).toContain('0 messages')
  })
})
