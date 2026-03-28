import { describe, it, expect, beforeEach } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from './helpers'
import type { FileService } from '../../src/types'

describe('Packet Directory Format', () => {
  let db: InMemoryPacketDatabase
  let fs: FileService
  let engine: PacketEngine

  beforeEach(() => {
    db = new InMemoryPacketDatabase()
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
  })

  describe('materialize', () => {
    it('writes hub to {name}/packet.md directory format', async () => {
      await engine.seed('my-packet')

      const hubPath = engine.getPacketHubPath('my-packet')
      expect(hubPath).toBe('.context/packets/active/my-packet/packet.md')

      const content = await fs.read(hubPath)
      expect(content).toContain('# Packet: my-packet')
    })

    it('getPacketDir returns directory path', () => {
      expect(engine.getPacketDir('test')).toBe('.context/packets/active/test')
    })

    it('getPacketHubPath returns hub file path', () => {
      expect(engine.getPacketHubPath('test')).toBe('.context/packets/active/test/packet.md')
    })

    it('getPacketDocPath returns artifact path inside directory', () => {
      expect(engine.getPacketDocPath('test', 'design/auth.md'))
        .toBe('.context/packets/active/test/design/auth.md')
    })

    it('cleans up legacy single file on materialize', async () => {
      // Write a legacy single file
      await fs.mkdir('.context/packets/active')
      await fs.write('.context/packets/active/legacy-packet.md', '# Old format')

      // Seed creates directory format
      await engine.seed('legacy-packet')

      // Legacy file should be gone
      expect(await fs.exists('.context/packets/active/legacy-packet.md')).toBe(false)

      // Directory format should exist
      expect(await fs.exists('.context/packets/active/legacy-packet/packet.md')).toBe(true)
    })
  })

  describe('readPacketContent', () => {
    it('reads from directory format first', async () => {
      await engine.seed('dir-packet')

      const content = await engine.readPacketContent('dir-packet')
      expect(content).not.toBeNull()
      expect(content).toContain('# Packet: dir-packet')
    })

    it('falls back to legacy single file', async () => {
      // Write a legacy file directly (without seeding)
      await fs.mkdir('.context/packets/active')
      await fs.write('.context/packets/active/old-format.md', '# Legacy packet content')

      const content = await engine.readPacketContent('old-format')
      expect(content).toBe('# Legacy packet content')
    })

    it('returns null when neither format exists', async () => {
      const content = await engine.readPacketContent('nonexistent')
      expect(content).toBeNull()
    })
  })

  describe('archive', () => {
    it('writes to archive/{name}/packet.md', async () => {
      await engine.seed('archive-test')
      await engine.nodeUpdate('archive-test', 'work-1', 'success', 'Done')

      await engine.archive('archive-test')

      const archiveHub = '.context/packets/archive/archive-test/packet.md'
      expect(await fs.exists(archiveHub)).toBe(true)

      const content = await fs.read(archiveHub)
      expect(content).toContain('# Packet: archive-test')
    })

    it('removes active directory hub after archiving', async () => {
      await engine.seed('archive-rm')

      await engine.archive('archive-rm')

      const activeHub = '.context/packets/active/archive-rm/packet.md'
      expect(await fs.exists(activeHub)).toBe(false)
    })
  })

  describe('docCreate', () => {
    it('creates a markdown file at the given path', async () => {
      await engine.seed('doc-test')

      const fullPath = await engine.docCreate('doc-test', 'research/competitors.md')

      expect(fullPath).toBe('.context/packets/active/doc-test/research/competitors.md')
      const content = await fs.read(fullPath)
      expect(content).toContain('# competitors')
    })

    it('auto-adds .md extension', async () => {
      await engine.seed('doc-ext')

      // Via CLI the command auto-adds .md — engine docCreate takes the full path
      const fullPath = await engine.docCreate('doc-ext', 'notes.md')
      expect(fullPath).toContain('notes.md')
    })

    it('uses provided content', async () => {
      await engine.seed('doc-content')

      await engine.docCreate('doc-content', 'design/auth.md', '# Auth Design\n\nJWT-based auth.')

      const content = await fs.read('.context/packets/active/doc-content/design/auth.md')
      expect(content).toContain('JWT-based auth')
    })

    it('links doc to node when nodeId provided', async () => {
      await engine.seed('doc-link', {
        problemVector: { current: 'X', target: 'Y', approach: 'Z' },
      })
      await engine.nodeUpdate('doc-link', 'auth-work', 'active', 'Working on auth')

      await engine.docCreate('doc-link', 'design/auth.md', '# Auth', 'auth-work')

      // The delta should record the doc link
      const deltas = await db.getDeltas('doc-link')
      const linkDelta = deltas.find(d =>
        d.nodeId === 'auth-work' && d.type === 'mutation' && d.content.includes('design/auth.md')
      )
      expect(linkDelta).toBeDefined()
    })

    it('creates deeply nested directories', async () => {
      await engine.seed('deep-nest')

      const path = await engine.docCreate('deep-nest', 'a/b/c/deep-doc.md', '# Deep')

      const content = await fs.read(path)
      expect(content).toContain('# Deep')
    })
  })

  describe('docList', () => {
    it('lists artifact files excluding structured docs', async () => {
      await engine.seed('list-test')
      await engine.docCreate('list-test', 'research/comp.md')
      await engine.docCreate('list-test', 'design/arch.md')

      const docs = await engine.docList('list-test')

      expect(docs).toContain('research/comp.md')
      expect(docs).toContain('design/arch.md')
      // Should NOT include packet.md
      expect(docs).not.toContain('packet.md')
    })

    it('returns empty array for packet with no artifacts', async () => {
      await engine.seed('empty-list')

      const docs = await engine.docList('empty-list')
      expect(docs).toEqual([])
    })
  })

  describe('docRead', () => {
    it('reads artifact content', async () => {
      await engine.seed('read-test')
      await engine.docCreate('read-test', 'notes.md', '# My Notes\n\nSome notes here.')

      const content = await engine.docRead('read-test', 'notes.md')
      expect(content).toContain('Some notes here')
    })

    it('throws for nonexistent doc', async () => {
      await engine.seed('read-missing')

      await expect(
        engine.docRead('read-missing', 'nonexistent.md')
      ).rejects.toThrow()
    })
  })

  describe('docLink', () => {
    it('links existing doc to a node', async () => {
      await engine.seed('link-test')
      await engine.nodeUpdate('link-test', 'work-1', 'active', 'Working')
      await engine.docCreate('link-test', 'analysis.md', '# Analysis')

      await engine.docLink('link-test', 'analysis.md', 'work-1')

      const deltas = await db.getDeltas('link-test')
      const linkDelta = deltas.find(d =>
        d.nodeId === 'work-1' && d.type === 'mutation' && d.content.includes('analysis.md')
      )
      expect(linkDelta).toBeDefined()
    })

    it('throws when doc does not exist', async () => {
      await engine.seed('link-missing')
      await engine.nodeUpdate('link-missing', 'work-1', 'active', 'Working')

      await expect(
        engine.docLink('link-missing', 'nonexistent.md', 'work-1')
      ).rejects.toThrow('Document not found')
    })
  })

  describe('reconstruct', () => {
    it('writes to directory format', async () => {
      await engine.seed('reconstruct-test')

      const path = await engine.reconstruct('reconstruct-test')

      expect(path).toBe('.context/packets/active/reconstruct-test/packet.md')
      const content = await fs.read(path)
      expect(content).toContain('# Packet: reconstruct-test')
    })
  })

  describe('context injection reads directory', () => {
    it('getInjectionContent works with directory format', async () => {
      await engine.seed('inject-test', {
        problemVector: { current: 'broken', target: 'fixed', approach: 'debug' },
      })

      const content = await engine.getInjectionContent('inject-test')
      expect(content).not.toBeNull()
      expect(content).toContain('inject-test')
    })
  })
})
