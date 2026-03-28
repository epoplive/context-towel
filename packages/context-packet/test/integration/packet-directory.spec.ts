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

  describe('reference fragments', () => {
    it('attach --ref creates fragment in refs/ directory', async () => {
      await engine.seed('ref-test')
      await engine.nodeUpdate('ref-test', 'auth-work', 'active', 'Auth work')

      // Create an external file to reference
      await fs.mkdir('docs')
      await fs.write('docs/architecture.md', '# Architecture\n\n## Auth\nJWT tokens.\n\n## Database\nPostgres.')

      // Attach reference via CLI
      await runCommand(engine, db, ['attach', 'auth-work', '--ref', 'docs/architecture.md'])

      // Fragment should exist in refs/
      const fragment = await fs.read('.context/packets/active/ref-test/refs/docs/architecture.md')
      expect(fragment).toContain('<!-- source: docs/architecture.md -->')
      expect(fragment).toContain('JWT tokens')
    })

    it('attach --ref with section extracts only that section', async () => {
      await engine.seed('section-test')
      await engine.nodeUpdate('section-test', 'auth-work', 'active', 'Auth work')

      await fs.mkdir('docs')
      await fs.write('docs/architecture.md', '# Architecture\n\n## Auth\nJWT tokens.\n\n## Database\nPostgres.\n\n## Caching\nRedis.')

      await runCommand(engine, db, ['attach', 'auth-work', '--ref', 'docs/architecture.md#Auth'])

      const fragment = await fs.read('.context/packets/active/section-test/refs/docs/architecture.md')
      expect(fragment).toContain('<!-- source: docs/architecture.md#Auth -->')
      expect(fragment).toContain('JWT tokens')
      // Should NOT contain other sections
      expect(fragment).not.toContain('Postgres')
      expect(fragment).not.toContain('Redis')
    })

    it('fragment includes source link for traceability', async () => {
      await engine.seed('trace-test')
      await engine.nodeUpdate('trace-test', 'work-1', 'active', 'Working')

      await fs.mkdir('src')
      await fs.write('src/auth.ts', 'export function authenticate() { /* ... */ }')

      await runCommand(engine, db, ['attach', 'work-1', '--ref', 'src/auth.ts'])

      const fragment = await fs.read('.context/packets/active/trace-test/refs/src/auth.ts')
      expect(fragment).toContain('<!-- source: src/auth.ts -->')
      expect(fragment).toContain('authenticate')
    })

    it('creates stub fragment when external file not readable', async () => {
      await engine.seed('missing-ref')
      await engine.nodeUpdate('missing-ref', 'work-1', 'active', 'Working')

      await runCommand(engine, db, ['attach', 'work-1', '--ref', 'nonexistent/file.md'])

      const fragment = await fs.read('.context/packets/active/missing-ref/refs/nonexistent/file.md')
      expect(fragment).toContain('<!-- source: nonexistent/file.md -->')
      expect(fragment).toContain('Could not read source file')
    })
  })

  describe('doc link does NOT corrupt node body', () => {
    it('node retains its original content when a doc is linked', async () => {
      await engine.seed('body-test')
      await engine.nodeUpdate('body-test', 'work-1', 'active', 'This is the real content')

      // Link a doc to the node
      await engine.docCreate('body-test', 'notes.md', '# Notes', 'work-1')

      // Hub should show real content in body, doc: in header
      const hub = await fs.read('.context/packets/active/body-test/packet.md')
      expect(hub).toContain('doc: notes.md')
      expect(hub).toContain('This is the real content')
      // Should NOT show raw JSON as body
      expect(hub).not.toMatch(/---\s*\n\s*\{"doc"/)
    })

    it('docLink also preserves node body', async () => {
      await engine.seed('link-body')
      await engine.nodeUpdate('link-body', 'work-1', 'active', 'Original body text')
      await engine.docCreate('link-body', 'artifact.md', '# Artifact')

      await engine.docLink('link-body', 'artifact.md', 'work-1')

      const hub = await fs.read('.context/packets/active/link-body/packet.md')
      expect(hub).toContain('doc: artifact.md')
      expect(hub).toContain('Original body text')
    })

    it('hub context (via buildContextOutput) shows node content not JSON', async () => {
      await engine.seed('inject-body', {
        problemVector: { current: 'X', target: 'Y', approach: 'Z' },
      })
      await engine.nodeUpdate('inject-body', 'work-1', 'active', 'Real work description')
      await engine.docCreate('inject-body', 'design.md', '# Design doc', 'work-1')

      const { buildContextOutput } = await import('../../src/cli/context')
      const mockReader = async (path: string) => fs.read(path)
      const output = await buildContextOutput('.context', 'inject-body', mockReader)

      expect(output).not.toBeNull()
      expect(output).toContain('Real work description')
      // Node summary should NOT be the raw JSON — it should be the real content
      // (The delta log may still contain the JSON mutation, that's fine)
      const nodesSection = output!.match(/<nodes>([\s\S]*?)<\/nodes>/)?.[1] ?? ''
      expect(nodesSection).toContain('Real work description')
      expect(nodesSection).not.toContain('{"doc"')
    })
  })

  describe('context injection follows doc links', () => {
    it('buildContextOutput includes doc content for active node', async () => {
      await engine.seed('follow-test', {
        problemVector: { current: 'X', target: 'Y', approach: 'Z' },
      })
      await engine.nodeUpdate('follow-test', 'auth-work', 'active', 'Auth implementation')
      await engine.docCreate(
        'follow-test',
        'design/auth.md',
        '# Auth Design\n\nUse JWT tokens with 15min expiry.',
        'auth-work',
      )

      // Import buildContextOutput to test with activeNode option
      const { buildContextOutput } = await import('../../src/cli/context')
      const mockReader = async (path: string) => fs.read(path)
      const output = await buildContextOutput(
        '.context',
        'follow-test',
        mockReader,
        { activeNode: 'auth-work' },
      )

      expect(output).not.toBeNull()
      // Should include the linked doc content for the active node
      expect(output).toContain('JWT tokens with 15min expiry')
      expect(output).toContain('design/auth.md')
    })
  })

  describe('reference fragments end-to-end', () => {
    it('attach --ref creates fragment, node shows doc: refs/ path', async () => {
      await engine.seed('ref-e2e')
      await engine.nodeUpdate('ref-e2e', 'work-1', 'active', 'Working on feature')

      await fs.mkdir('docs')
      await fs.write('docs/architecture.md', '# Architecture\n\n## Auth\nJWT tokens.\n\n## Database\nPostgres.')

      await runCommand(engine, db, ['attach', 'work-1', '--ref', 'docs/architecture.md'])

      // Fragment should exist
      const fragment = await fs.read('.context/packets/active/ref-e2e/refs/docs/architecture.md')
      expect(fragment).toContain('<!-- source: docs/architecture.md -->')
      expect(fragment).toContain('JWT tokens')

      // Hub should show the reference node
      const hub = await fs.read('.context/packets/active/ref-e2e/packet.md')
      expect(hub).toContain('refs/docs/architecture.md')
    })

    it('section extraction only gets the named section', async () => {
      await engine.seed('section-e2e')
      await engine.nodeUpdate('section-e2e', 'work-1', 'active', 'Working')

      await fs.mkdir('docs')
      await fs.write('docs/guide.md', '# Guide\n\n## Setup\nInstall deps.\n\n## Usage\nRun the app.\n\n## Testing\nRun vitest.')

      await runCommand(engine, db, ['attach', 'work-1', '--ref', 'docs/guide.md#Usage'])

      const fragment = await fs.read('.context/packets/active/section-e2e/refs/docs/guide.md')
      expect(fragment).toContain('Run the app')
      expect(fragment).not.toContain('Install deps')
      expect(fragment).not.toContain('Run vitest')
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
