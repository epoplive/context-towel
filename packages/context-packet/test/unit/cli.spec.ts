import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { PacketEngine } from '../../src/PacketEngine'
import { runCommand, parseArgs } from '../../src/cli/commands'
import type { FileService } from '../../src/types'

// ============================================================================
// CLI Command Tests — Tests CLI commands using real PacketEngine + InMemoryDB
// ============================================================================

// Mock FileService that stores files in memory
function createMockFs(): FileService {
  const files = new Map<string, string>()
  const dirs = new Set<string>()

  return {
    async read(path: string): Promise<string> {
      const content = files.get(path)
      if (content === undefined) throw new Error(`File not found: ${path}`)
      return content
    },
    async write(path: string, content: string): Promise<void> {
      files.set(path, content)
    },
    async exists(path: string): Promise<boolean> {
      return files.has(path) || dirs.has(path)
    },
    async mkdir(dirPath: string): Promise<void> {
      dirs.add(dirPath)
    },
    async list(dirPath: string): Promise<{ name: string; path: string; is_dir: boolean }[]> {
      const entries: { name: string; path: string; is_dir: boolean }[] = []
      for (const [p] of files) {
        if (p.startsWith(dirPath + '/')) {
          const rest = p.slice(dirPath.length + 1)
          if (!rest.includes('/')) {
            entries.push({ name: rest, path: p, is_dir: false })
          }
        }
      }
      return entries
    },
    async remove(filePath: string): Promise<void> {
      files.delete(filePath)
    },
  }
}

// Capture console.log output
function captureOutput(): { logs: string[]; restore: () => void } {
  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  }
  return {
    logs,
    restore: () => { console.log = originalLog },
  }
}

describe('CLI Commands', () => {
  let db: InMemoryPacketDatabase
  let engine: PacketEngine
  let mockFs: FileService

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    mockFs = createMockFs()
    engine = new PacketEngine(db, '/test/.context', mockFs)
  })

  // ── parseArgs ──────────────────────────────────────────────────────

  describe('parseArgs', () => {
    it('parses flags and positional args', () => {
      const result = parseArgs(['--name', 'test', '--plan', 'plan.md', 'extra'])
      expect(result.flags).toEqual({ name: 'test', plan: 'plan.md' })
      expect(result.positional).toEqual(['extra'])
    })

    it('handles flags without values', () => {
      const result = parseArgs(['--verbose', '--name', 'test'])
      expect(result.flags).toEqual({ verbose: 'true', name: 'test' })
    })

    it('handles empty args', () => {
      const result = parseArgs([])
      expect(result.flags).toEqual({})
      expect(result.positional).toEqual([])
    })

    it('handles only positional args', () => {
      const result = parseArgs(['hello', 'world'])
      expect(result.flags).toEqual({})
      expect(result.positional).toEqual(['hello', 'world'])
    })
  })

  // ── seed ───────────────────────────────────────────────────────────

  describe('seed', () => {
    it('creates a new packet', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['seed', '--name', 'test-packet'])
        expect(output.logs).toHaveLength(1)
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('created')
        expect(result.name).toBe('test-packet')

        // Verify packet was actually created
        const meta = await db.getPacketMeta('test-packet')
        expect(meta).not.toBeNull()
      } finally {
        output.restore()
      }
    })

    it('creates a packet with plan file ref', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['seed', '--name', 'planned', '--plan', 'plan.md'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('created')

        const meta = await db.getPacketMeta('planned')
        expect(meta!.planFileRef).toBe('plan.md')
      } finally {
        output.restore()
      }
    })

    it('throws when --name is missing', async () => {
      await expect(runCommand(engine, db, ['seed'])).rejects.toThrow('--name is required')
    })
  })

  // ── list ───────────────────────────────────────────────────────────

  describe('list', () => {
    it('lists all packets', async () => {
      await engine.seed('packet-a')
      await engine.seed('packet-b')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['list'])
        const result = JSON.parse(output.logs[0])
        expect(result).toHaveLength(2)
        const names = result.map((p: { name: string }) => p.name).sort()
        expect(names).toEqual(['packet-a', 'packet-b'])
      } finally {
        output.restore()
      }
    })

    it('shows active flag on active packet', async () => {
      await engine.seed('packet-a')
      await engine.seed('packet-b')
      await db.setActivePacket('packet-a')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['list'])
        const result = JSON.parse(output.logs[0])
        const activePacket = result.find((p: { name: string }) => p.name === 'packet-a')
        const inactivePacket = result.find((p: { name: string }) => p.name === 'packet-b')
        expect(activePacket.active).toBe(true)
        expect(inactivePacket.active).toBe(false)
      } finally {
        output.restore()
      }
    })

    it('returns empty array when no packets', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['list'])
        const result = JSON.parse(output.logs[0])
        expect(result).toEqual([])
      } finally {
        output.restore()
      }
    })
  })

  // ── active ─────────────────────────────────────────────────────────

  describe('active', () => {
    it('sets the active packet', async () => {
      await engine.seed('test-packet')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['active', 'test-packet'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('active')
        expect(result.name).toBe('test-packet')

        expect(await db.getActivePacket()).toBe('test-packet')
      } finally {
        output.restore()
      }
    })

    it('gets the active packet', async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['active'])
        const result = JSON.parse(output.logs[0])
        expect(result.active).toBe('test-packet')
      } finally {
        output.restore()
      }
    })

    it('returns null when no active packet', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['active'])
        const result = JSON.parse(output.logs[0])
        expect(result.active).toBeNull()
      } finally {
        output.restore()
      }
    })
  })

  // ── node ───────────────────────────────────────────────────────────

  describe('node', () => {
    beforeEach(async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')
    })

    it('updates a node', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, [
          'node', 'update', 'auth',
          '--state', 'active',
          '--content', 'implementing auth module',
        ])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('updated')
        expect(result.nodeId).toBe('auth')
        expect(result.state).toBe('active')
      } finally {
        output.restore()
      }
    })

    it('lists nodes', async () => {
      await engine.nodeUpdate('test-packet', 'auth', 'active', 'auth content')
      await engine.nodeUpdate('test-packet', 'db', 'success', 'db content')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['node', 'list'])
        const result = JSON.parse(output.logs[0])
        expect(result).toHaveLength(2)
        const ids = result.map((n: { id: string }) => n.id).sort()
        expect(ids).toEqual(['auth', 'db'])
      } finally {
        output.restore()
      }
    })

    it('promotes a node', async () => {
      await engine.nodeUpdate('test-packet', 'auth', 'active', 'auth content')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['node', 'promote', 'auth'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('promoted')
        expect(result.nodeId).toBe('auth')
      } finally {
        output.restore()
      }
    })

    it('throws when no active packet', async () => {
      await db.setActivePacket(null)
      await expect(
        runCommand(engine, db, ['node', 'list']),
      ).rejects.toThrow('No active packet')
    })
  })

  // ── inject ─────────────────────────────────────────────────────────

  describe('inject', () => {
    it('outputs injection content for active packet', async () => {
      await engine.seed('test-packet', {
        problemVector: {
          current: 'no auth',
          target: 'full auth',
          approach: 'JWT tokens',
        },
      })
      await db.setActivePacket('test-packet')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['inject'])
        expect(output.logs.length).toBeGreaterThan(0)
        const content = output.logs.join('\n')
        expect(content).toContain('test-packet')
        expect(content).toContain('no auth')
      } finally {
        output.restore()
      }
    })

    it('shows message when no active packet', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['inject'])
        expect(output.logs[0]).toContain('No active packet')
      } finally {
        output.restore()
      }
    })
  })

  // ── snapshot ────────────────────────────────────────────────────────

  describe('snapshot', () => {
    it('re-materializes active packet', async () => {
      await engine.seed('test-packet')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['snapshot'])
        expect(output.logs).toHaveLength(1)
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('snapshot')
        expect(result.name).toBe('test-packet')
        expect(result.path).toContain('test-packet/packet.md')
      } finally {
        output.restore()
      }
    })

    it('is silent when no active packet', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['snapshot'])
        expect(output.logs).toHaveLength(0)
      } finally {
        output.restore()
      }
    })
  })

  // ── active with marker ─────────────────────────────────────────────

  describe('active (with marker)', () => {
    it('writes marker file when setting active', async () => {
      await engine.seed('test-packet')
      // seed now auto-sets active, so clear it first
      await db.setActivePacket(null)
      await engine.syncActiveMarker(null)

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['active', 'test-packet'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('active')

        // Verify marker was written
        const marker = await mockFs.read('/test/.context/active')
        expect(marker).toBe('test-packet')
      } finally {
        output.restore()
      }
    })
  })

  // ── unknown command ────────────────────────────────────────────────

  describe('unknown command', () => {
    it('throws for unknown command', async () => {
      await expect(
        runCommand(engine, db, ['nonexistent']),
      ).rejects.toThrow('Unknown command: nonexistent')
    })

    it('prints usage for no command', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, [])
        expect(output.logs[0]).toContain('Usage: packet')
      } finally {
        output.restore()
      }
    })
  })

  // ── whiteboard ─────────────────────────────────────────────────────

  describe('whiteboard', () => {
    beforeEach(async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')
    })

    it('updates a whiteboard section', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, [
          'whiteboard', 'update',
          '--section', 'architecture',
          '--content', 'graph TD; A-->B',
        ])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('updated')
        expect(result.section).toBe('architecture')
      } finally {
        output.restore()
      }
    })

    it('lists whiteboard sections', async () => {
      await engine.whiteboardUpdate('test-packet', 'arch', 'graph TD; A-->B')
      await engine.whiteboardUpdate('test-packet', 'flow', 'graph LR; X-->Y')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['whiteboard', 'list'])
        const result = JSON.parse(output.logs[0])
        expect(result).toHaveLength(2)
        const sections = result.map((s: { section: string }) => s.section).sort()
        expect(sections).toEqual(['arch', 'flow'])
      } finally {
        output.restore()
      }
    })
  })

  // ── vector ─────────────────────────────────────────────────────────

  describe('vector', () => {
    beforeEach(async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')
    })

    it('updates a vector', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, [
          'vector', 'update', 'auth-v',
          '--current', 'no auth',
          '--target', 'full auth',
          '--approach', 'JWT tokens',
        ])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('updated')
        expect(result.vectorId).toBe('auth-v')
      } finally {
        output.restore()
      }
    })

    it('lists vectors', async () => {
      await engine.vectorUpdate('test-packet', 'v1', 'current1', 'target1', 'approach1')
      await engine.vectorUpdate('test-packet', 'v2', 'current2', 'target2', 'approach2')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['vector', 'list'])
        const result = JSON.parse(output.logs[0])
        expect(result).toHaveLength(2)
      } finally {
        output.restore()
      }
    })

    it('resolves a vector', async () => {
      await engine.vectorUpdate('test-packet', 'v1', 'current1', 'target1', 'approach1')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['vector', 'resolve', 'v1'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('resolved')
      } finally {
        output.restore()
      }
    })
  })

  // ── delta ──────────────────────────────────────────────────────────

  describe('delta', () => {
    beforeEach(async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')
    })

    it('appends a delta', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, [
          'delta', 'append',
          '--node', 'auth',
          '--type', 'discovery',
          '--content', 'found a pattern',
        ])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('appended')
      } finally {
        output.restore()
      }
    })

    it('lists deltas', async () => {
      await engine.deltaAppend('test-packet', 'auth', 'discovery', 'delta content')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['delta', 'list'])
        const result = JSON.parse(output.logs[0])
        // There will be deltas from seed + our append
        expect(result.length).toBeGreaterThan(0)
      } finally {
        output.restore()
      }
    })
  })

  // ── collapse ───────────────────────────────────────────────────────

  describe('collapse', () => {
    it('collapses deltas for a node', async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')
      await engine.nodeUpdate('test-packet', 'auth', 'active', 'v1')
      await engine.nodeUpdate('test-packet', 'auth', 'active', 'v2')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['collapse', 'auth'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('collapsed')
        expect(result.nodeId).toBe('auth')
      } finally {
        output.restore()
      }
    })
  })

  // ── edge ───────────────────────────────────────────────────────────

  describe('edge', () => {
    beforeEach(async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')
      await engine.nodeUpdate('test-packet', 'work-1', 'active', 'Work node')
      await engine.nodeUpdate('test-packet', 'ref-1', 'active', 'Reference node')
    })

    it('adds an edge', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['edge', 'add', 'work-1', 'ref-1'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('added')
        expect(result.source).toBe('work-1')
        expect(result.target).toBe('ref-1')
        expect(result.id).toBeTruthy()
      } finally {
        output.restore()
      }
    })

    it('removes an edge', async () => {
      await engine.edgeAdd('test-packet', 'work-1', 'ref-1')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['edge', 'remove', 'work-1', 'ref-1'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('removed')
      } finally {
        output.restore()
      }

      const edges = await engine.edgeList('test-packet')
      expect(edges.length).toBe(0)
    })

    it('lists all edges', async () => {
      await engine.edgeAdd('test-packet', 'work-1', 'ref-1')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['edge', 'list'])
        const result = JSON.parse(output.logs[0])
        expect(result).toHaveLength(1)
        expect(result[0].source).toBe('work-1')
        expect(result[0].target).toBe('ref-1')
      } finally {
        output.restore()
      }
    })

    it('lists edges for a specific node', async () => {
      await engine.nodeUpdate('test-packet', 'ref-2', 'active', 'Another ref')
      await engine.edgeAdd('test-packet', 'work-1', 'ref-1')
      await engine.edgeAdd('test-packet', 'work-1', 'ref-2')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['edge', 'list', 'work-1'])
        const result = JSON.parse(output.logs[0])
        expect(result).toHaveLength(2)
      } finally {
        output.restore()
      }
    })
  })

  // ── attach ──────────────────────────────────────────────────────────

  describe('attach', () => {
    beforeEach(async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')
      await engine.nodeUpdate('test-packet', 'auth-work', 'active', 'Auth implementation')
    })

    it('attaches a reference node', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['attach', 'auth-work', '--ref', './docs/auth.md'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('attached')
        expect(result.workNode).toBe('auth-work')
        expect(result.type).toBe('reference')
        expect(result.path).toBe('./docs/auth.md')
      } finally {
        output.restore()
      }

      // Verify node was created
      const edges = await engine.edgeList('test-packet', 'auth-work')
      expect(edges.length).toBe(1)
    })

    it('attaches a test node', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['attach', 'auth-work', '--test', 'test/auth.spec.ts'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('attached')
        expect(result.type).toBe('test')
      } finally {
        output.restore()
      }
    })

    it('attaches a diagram node', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['attach', 'auth-work', '--diagram', 'graph TD; A-->B'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('attached')
        expect(result.type).toBe('diagram')
      } finally {
        output.restore()
      }
    })

    it('uses custom id when --id provided', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['attach', 'auth-work', '--ref', './docs/auth.md', '--id', 'my-ref'])
        const result = JSON.parse(output.logs[0])
        expect(result.nodeId).toBe('my-ref')
      } finally {
        output.restore()
      }
    })

    it('auto-generates node id from path', async () => {
      const output = captureOutput()
      try {
        await runCommand(engine, db, ['attach', 'auth-work', '--ref', './docs/auth.md'])
        const result = JSON.parse(output.logs[0])
        expect(result.nodeId).toContain('ref-')
      } finally {
        output.restore()
      }
    })

    it('creates node + edge in one command', async () => {
      await runCommand(engine, db, ['attach', 'auth-work', '--ref', './docs/auth.md'])

      // Should have created a typed node
      const content = await mockFs.read(engine.getPacketPath('test-packet'))
      expect(content).toContain('type: reference')
      expect(content).toContain('path: ./docs/auth.md')

      // Should have created an edge
      const edges = await engine.edgeList('test-packet', 'auth-work')
      expect(edges.length).toBe(1)
    })
  })

  // ── docs ───────────────────────────────────────────────────────────

  describe('docs', () => {
    it('materializes the active packet', async () => {
      await engine.seed('test-packet')
      await db.setActivePacket('test-packet')

      const output = captureOutput()
      try {
        await runCommand(engine, db, ['docs', 'materialize'])
        const result = JSON.parse(output.logs[0])
        expect(result.status).toBe('materialized')
        expect(result.path).toContain('test-packet/packet.md')
      } finally {
        output.restore()
      }
    })
  })
})
