import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from '../unit/helpers'
import { runCommand } from '../../src/cli/commands'
import type { FileService } from '../../src/types'
import type { PacketDatabase } from '../../src/storage/PacketDatabase'

/**
 * Integration tests for the packet directory format.
 * Uses real PacketEngine + InMemoryPacketDatabase (full delta chain behavior).
 * Tests end-to-end CLI → engine → DB → filesystem flows.
 */

describe('Packet Directory Format (integration)', () => {
  let db: PacketDatabase
  let fs: FileService
  let engine: PacketEngine
  let output: string[]

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
    output = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output.push(args.map(String).join(' '))
    })
  })

  describe('full lifecycle: seed → doc create → materialize → context', () => {
    it('creates packet directory with hub and artifacts', async () => {
      // 1. Seed packet with problem vector
      await engine.seed('research', {
        problemVector: {
          current: 'No competitor data',
          target: 'Full competitor analysis',
          approach: 'Research top 3 competitors',
        },
      })

      // Verify directory format
      const hub = await fs.read('.context/packets/active/research/packet.md')
      expect(hub).toContain('# Packet: research')
      expect(hub).toContain('No competitor data')

      // 2. Add work nodes
      await engine.nodeUpdate('research', 'acme-analysis', 'active', 'Analyzing Acme Corp')
      await engine.nodeUpdate('research', 'rival-analysis', 'active', 'Analyzing Rival Inc')

      // 3. Create artifact docs linked to nodes
      await engine.docCreate(
        'research',
        'findings/acme-corp.md',
        '# Acme Corp Analysis\n\n## Market Position\nPremium tier, enterprise focus.\n\n## Pricing\n$500/mo base.',
        'acme-analysis',
      )
      await engine.docCreate(
        'research',
        'findings/rival-inc.md',
        '# Rival Inc Analysis\n\n## Market Position\nMid-market, SMB focus.\n\n## Pricing\n$99/mo.',
        'rival-analysis',
      )

      // 4. Verify artifacts exist
      const docs = await engine.docList('research')
      expect(docs).toContain('findings/acme-corp.md')
      expect(docs).toContain('findings/rival-inc.md')

      // 5. Verify artifact content
      const acmeContent = await engine.docRead('research', 'findings/acme-corp.md')
      expect(acmeContent).toContain('Acme Corp Analysis')
      expect(acmeContent).toContain('$500/mo base')

      // 6. Verify hub updated with node deltas
      const updatedHub = await fs.read('.context/packets/active/research/packet.md')
      expect(updatedHub).toContain('acme-analysis')
      expect(updatedHub).toContain('rival-analysis')

      // 7. Add edges between nodes
      await engine.edgeAdd('research', 'acme-analysis', 'rival-analysis')
      const edges = await engine.edgeList('research')
      expect(edges).toHaveLength(1)

      // 8. Promote a node
      await engine.nodeUpdate('research', 'acme-analysis', 'success', 'Acme analysis complete')
      await engine.nodePromote('research', 'acme-analysis')

      const finalHub = await fs.read('.context/packets/active/research/packet.md')
      expect(finalHub).toContain('success')
    })
  })

  describe('CLI doc commands end-to-end', () => {
    it('doc create via CLI creates file and outputs JSON', async () => {
      await engine.seed('cli-doc')

      await runCommand(engine, db, ['doc', 'create', 'design/auth', '--content', 'JWT auth design'])

      const json = JSON.parse(output[output.length - 1])
      expect(json.status).toBe('created')
      expect(json.path).toBe('design/auth.md')

      const content = await fs.read('.context/packets/active/cli-doc/design/auth.md')
      expect(content).toBe('JWT auth design')
    })

    it('doc create with --node links to node via CLI', async () => {
      await engine.seed('cli-link')
      await engine.nodeUpdate('cli-link', 'work-1', 'active', 'Working')

      await runCommand(engine, db, ['doc', 'create', 'notes/findings', '--node', 'work-1', '--content', '# Findings'])

      const json = JSON.parse(output[output.length - 1])
      expect(json.nodeId).toBe('work-1')

      // Verify delta records the link
      const deltas = await db.getDeltas('cli-link')
      const linkDelta = deltas.find(d => d.nodeId === 'work-1' && d.content.includes('notes/findings.md'))
      expect(linkDelta).toBeDefined()
    })

    it('doc list via CLI lists all artifacts', async () => {
      await engine.seed('cli-list')
      await engine.docCreate('cli-list', 'a.md', 'doc a')
      await engine.docCreate('cli-list', 'sub/b.md', 'doc b')

      await runCommand(engine, db, ['doc', 'list'])

      const json = JSON.parse(output[output.length - 1])
      expect(json).toContain('a.md')
      expect(json).toContain('sub/b.md')
    })

    it('doc read via CLI outputs content', async () => {
      await engine.seed('cli-read')
      await engine.docCreate('cli-read', 'readme.md', '# Hello World')

      await runCommand(engine, db, ['doc', 'read', 'readme.md'])

      expect(output[output.length - 1]).toContain('# Hello World')
    })

    it('doc link via CLI links existing doc to node', async () => {
      await engine.seed('cli-link2')
      await engine.nodeUpdate('cli-link2', 'work-1', 'active', 'Working')
      await engine.docCreate('cli-link2', 'existing.md', '# Existing doc')

      await runCommand(engine, db, ['doc', 'link', 'existing.md', '--node', 'work-1'])

      const json = JSON.parse(output[output.length - 1])
      expect(json.status).toBe('linked')
    })

    it('doc link throws for nonexistent doc', async () => {
      await engine.seed('cli-link-fail')
      await engine.nodeUpdate('cli-link-fail', 'work-1', 'active', 'Working')

      await expect(
        runCommand(engine, db, ['doc', 'link', 'nonexistent.md', '--node', 'work-1'])
      ).rejects.toThrow('Document not found')
    })
  })

  describe('backward compatibility', () => {
    it('readPacketContent reads legacy single file', async () => {
      // Simulate a legacy packet (single .md file, no directory)
      await fs.mkdir('.context/packets/active')
      await fs.write('.context/packets/active/old-packet.md', '# Packet: old-packet\n\n## Whiteboard\n')

      const content = await engine.readPacketContent('old-packet')
      expect(content).toContain('# Packet: old-packet')
    })

    it('materialize cleans up legacy file when creating directory', async () => {
      // Create legacy file
      await fs.mkdir('.context/packets/active')
      await fs.write('.context/packets/active/migrating.md', '# Old content')

      // Seed creates directory format
      await engine.seed('migrating')

      // Legacy file should be removed
      expect(await fs.exists('.context/packets/active/migrating.md')).toBe(false)

      // Directory format should exist
      expect(await fs.exists('.context/packets/active/migrating/packet.md')).toBe(true)
    })
  })

  describe('multi-packet isolation', () => {
    it('artifacts in different packets are isolated', async () => {
      await engine.seed('packet-a')
      await engine.seed('packet-b')

      await engine.docCreate('packet-a', 'shared-name.md', 'Content A')
      await engine.docCreate('packet-b', 'shared-name.md', 'Content B')

      const contentA = await engine.docRead('packet-a', 'shared-name.md')
      const contentB = await engine.docRead('packet-b', 'shared-name.md')

      expect(contentA).toBe('Content A')
      expect(contentB).toBe('Content B')
    })
  })
})
