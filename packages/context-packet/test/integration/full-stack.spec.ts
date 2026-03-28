/**
 * Full-stack integration tests — MikroORM backend, real PacketEngine, real CLI commands.
 * Minimal mocks: only the FileService is in-memory (no real filesystem).
 * Everything else is real: MikroORM + SQLite, PacketEngine, CLI commands, context injection.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { MikroORM } from '@mikro-orm/sqlite'
import { MikroOrmPacketDatabase } from '../../src/storage/MikroOrmPacketDatabase'
import { packetEntities } from '../../src/storage/entities'
import { PacketEngine } from '../../src/PacketEngine'
import { runCommand } from '../../src/cli/commands'
import { buildContextOutput } from '../../src/cli/context'
import { createMockFs } from '../unit/helpers'
import type { FileService } from '../../src/types'
import type { PacketDatabase } from '../../src/storage/PacketDatabase'

describe('Full-stack integration (MikroORM + PacketEngine + CLI)', () => {
  let orm: MikroORM
  let db: PacketDatabase
  let fs: FileService
  let engine: PacketEngine
  let output: string[]

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: packetEntities,
      dbName: ':memory:',
      allowGlobalContext: true,
    })
  })

  beforeEach(async () => {
    const generator = orm.getSchemaGenerator()
    await generator.refreshDatabase()
    db = new MikroOrmPacketDatabase(orm.em)
    fs = createMockFs()
    engine = new PacketEngine(db, '.context', fs)
    output = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output.push(args.map(String).join(' '))
    })
  })

  describe('seed → doc → workflow → lessons → context lifecycle', () => {
    it('complete packet lifecycle with MikroORM backend', async () => {
      // 1. Seed with template
      await runCommand(engine, db, ['seed', '--name', 'full-test', '--template', 'dev-packet'])
      expect(JSON.parse(output.pop()!).status).toBe('created')

      // 2. Verify directory structure
      const hub = await fs.read('.context/packets/active/full-test/packet.md')
      expect(hub).toContain('# Packet: full-test')
      const workflow = await fs.read('.context/packets/active/full-test/workflow.md')
      expect(workflow).toContain('# Workflow: Development Packet')
      const lessons = await fs.read('.context/packets/active/full-test/lessons.md')
      expect(lessons).toContain('# Lessons')

      // 3. Add vector
      await runCommand(engine, db, [
        'vector', 'update', 'primary',
        '--current', 'No auth', '--target', 'JWT auth', '--approach', 'Incremental',
      ])

      // 4. Add work node
      await runCommand(engine, db, ['node', 'update', 'auth-impl', '--state', 'active', '--content', 'Implementing JWT auth'])

      // 5. Create doc artifact linked to node
      await runCommand(engine, db, ['doc', 'create', 'design/auth-architecture', '--node', 'auth-impl', '--content', '# Auth Architecture\n\nJWT with refresh tokens. 15min access, 7d refresh.'])
      const docResult = JSON.parse(output.pop()!)
      expect(docResult.status).toBe('created')
      expect(docResult.path).toBe('design/auth-architecture.md')

      // 6. Verify doc exists and node has doc: field in hub
      const docContent = await engine.docRead('full-test', 'design/auth-architecture.md')
      expect(docContent).toContain('JWT with refresh tokens')

      const updatedHub = await fs.read('.context/packets/active/full-test/packet.md')
      expect(updatedHub).toContain('doc: design/auth-architecture.md')
      expect(updatedHub).toContain('Implementing JWT auth')

      // 7. Add lesson
      await runCommand(engine, db, ['lesson', 'add', '--content', 'Refresh tokens need httpOnly cookies'])
      const lessonContent = await fs.read('.context/packets/active/full-test/lessons.md')
      expect(lessonContent).toContain('Refresh tokens need httpOnly cookies')

      // 8. Check workflow status
      output.length = 0
      await runCommand(engine, db, ['workflow', 'status'])
      const statuses = JSON.parse(output.pop()!)
      expect(statuses.length).toBeGreaterThan(0)
      expect(statuses[0].name).toBe('research')

      // 9. Attach external reference
      await fs.mkdir('docs')
      await fs.write('docs/security-guide.md', '# Security Guide\n\n## Token Management\nAlways use httpOnly cookies.\n\n## Session Handling\nRotate on privilege escalation.')
      await runCommand(engine, db, ['attach', 'auth-impl', '--ref', 'docs/security-guide.md#Token Management'])

      // Verify fragment created
      const fragment = await fs.read('.context/packets/active/full-test/refs/docs/security-guide.md')
      expect(fragment).toContain('<!-- source: docs/security-guide.md#Token Management -->')
      expect(fragment).toContain('Always use httpOnly cookies')
      expect(fragment).not.toContain('Session Handling')

      // 10. Context injection
      const mockReader = async (path: string) => fs.read(path)
      const ctx = await buildContextOutput('.context', 'full-test', mockReader)
      expect(ctx).not.toBeNull()
      expect(ctx).toContain('No auth')
      expect(ctx).toContain('JWT auth')
      expect(ctx).toContain('auth-impl')
      expect(ctx).toContain('Implementing JWT auth')
      expect(ctx).toContain('Refresh tokens need httpOnly cookies') // lessons

      // 11. Context injection with active node follows doc link
      const activeCtx = await buildContextOutput('.context', 'full-test', mockReader, { activeNode: 'auth-impl' })
      expect(activeCtx).not.toBeNull()
      expect(activeCtx).toContain('JWT with refresh tokens') // linked doc content

      // 12. Promote node
      await runCommand(engine, db, ['node', 'update', 'auth-impl', '--state', 'success', '--content', 'Auth implemented'])
      await runCommand(engine, db, ['node', 'promote', 'auth-impl', '--skip-tests', 'true'])

      // 13. List docs
      output.length = 0
      await runCommand(engine, db, ['doc', 'list'])
      const docs = JSON.parse(output.pop()!)
      expect(docs).toContain('design/auth-architecture.md')

      // 14. Archive
      await runCommand(engine, db, ['archive', 'full-test'])
      const archiveHub = await fs.read('.context/packets/archive/full-test/packet.md')
      expect(archiveHub).toContain('# Packet: full-test')
    })
  })

  describe('scanQuestions', () => {
    it('finds questions across all docs in packet', async () => {
      await engine.seed('q-test')
      await engine.docCreate('q-test', 'design/auth.md', `# Auth Design

~~~question
id: q1
---
What auth method should we use?
~~~

Some design text.

~~~question
id: q2
response: JWT with refresh
---
What token strategy?
~~~
`)
      await engine.docCreate('q-test', 'design/db.md', `# DB Design

~~~question
id: q3
---
Postgres or SQLite?
~~~
`)

      const questions = await engine.scanQuestions('q-test')
      expect(questions).toHaveLength(3)

      const q1 = questions.find(q => q.id === 'q1')!
      expect(q1.text).toBe('What auth method should we use?')
      expect(q1.answered).toBe(false)
      expect(q1.file).toBe('design/auth.md')

      const q2 = questions.find(q => q.id === 'q2')!
      expect(q2.answered).toBe(true)
      expect(q2.response).toBe('JWT with refresh')

      const q3 = questions.find(q => q.id === 'q3')!
      expect(q3.file).toBe('design/db.md')
      expect(q3.answered).toBe(false)
    })

    it('returns empty for packet with no questions', async () => {
      await engine.seed('no-q')
      await engine.docCreate('no-q', 'notes.md', '# Just notes\nNo questions here.')
      expect(await engine.scanQuestions('no-q')).toEqual([])
    })

    it('CLI: packet questions list', async () => {
      await engine.seed('cli-q')
      await engine.docCreate('cli-q', 'doc.md', '~~~question\nid: q1\n---\nIs this working?\n~~~')

      output.length = 0
      await runCommand(engine, db, ['questions', 'list'])
      const questions = JSON.parse(output.pop()!)
      expect(questions).toHaveLength(1)
      expect(questions[0].id).toBe('q1')
    })
  })

  describe('createRefFragment', () => {
    it('creates fragment for full file', async () => {
      await engine.seed('ref-full')
      await fs.write('external.md', '# External Doc\nFull content here.')

      const refsPath = await engine.createRefFragment('ref-full', 'external.md')

      expect(refsPath).toBe('refs/external.md')
      const content = await fs.read('.context/packets/active/ref-full/refs/external.md')
      expect(content).toContain('<!-- source: external.md -->')
      expect(content).toContain('Full content here')
    })

    it('extracts section by heading', async () => {
      await engine.seed('ref-section')
      await fs.write('guide.md', '# Guide\n\n## Setup\nInstall deps.\n\n## Usage\nRun it.\n\n## Testing\nTest it.')

      const refsPath = await engine.createRefFragment('ref-section', 'guide.md', 'Usage')

      const content = await fs.read(`.context/packets/active/ref-section/${refsPath}`)
      expect(content).toContain('<!-- source: guide.md#Usage -->')
      expect(content).toContain('Run it')
      expect(content).not.toContain('Install deps')
      expect(content).not.toContain('Test it')
    })

    it('creates stub for unreadable file', async () => {
      await engine.seed('ref-missing')
      const refsPath = await engine.createRefFragment('ref-missing', 'nonexistent.md')

      const content = await fs.read(`.context/packets/active/ref-missing/${refsPath}`)
      expect(content).toContain('Could not read source file')
    })

    it('handles deeply nested external paths', async () => {
      await engine.seed('ref-deep')
      await fs.mkdir('src/auth')
      await fs.write('src/auth/middleware.ts', 'export function auth() {}')

      const refsPath = await engine.createRefFragment('ref-deep', 'src/auth/middleware.ts')
      expect(refsPath).toBe('refs/src/auth/middleware.ts')

      const content = await fs.read('.context/packets/active/ref-deep/refs/src/auth/middleware.ts')
      expect(content).toContain('export function auth')
    })
  })

  describe('dynamic instructions', () => {
    it('includes lessons commands when lessons.md exists', async () => {
      await engine.seed('instr-lessons', { template: 'dev-packet' })
      await engine.lessonAdd('instr-lessons', 'A lesson')

      const mockReader = async (path: string) => fs.read(path)
      const ctx = await buildContextOutput('.context', 'instr-lessons', mockReader)

      expect(ctx).toContain('packet lesson add')
      expect(ctx).toContain('Lessons (scoped to this packet)')
    })

    it('includes workflow commands when workflow.md exists', async () => {
      await engine.seed('instr-wf', { template: 'dev-packet' })

      const mockReader = async (path: string) => fs.read(path)
      const ctx = await buildContextOutput('.context', 'instr-wf', mockReader)

      expect(ctx).toContain('packet workflow status')
      expect(ctx).toContain('workflow.md defines the structure')
    })

    it('omits lessons/workflow commands when those files dont exist', async () => {
      await engine.seed('instr-bare') // no template

      const mockReader = async (path: string) => fs.read(path)
      const ctx = await buildContextOutput('.context', 'instr-bare', mockReader)

      // Should have core commands
      expect(ctx).toContain('packet delta append')
      expect(ctx).toContain('packet doc create')
      // Should NOT have workflow/lesson specific commands (no workflow.md)
      expect(ctx).not.toContain('packet workflow status')
    })

    it('always includes doc commands', async () => {
      await engine.seed('instr-docs')

      const mockReader = async (path: string) => fs.read(path)
      const ctx = await buildContextOutput('.context', 'instr-docs', mockReader)

      expect(ctx).toContain('packet doc create')
      expect(ctx).toContain('packet doc read')
      expect(ctx).toContain('packet attach')
    })
  })

  describe('FsDocStore behavior via PacketEngine', () => {
    it('docList excludes structured docs', async () => {
      await engine.seed('docstore-test', { template: 'dev-packet' })
      await engine.docCreate('docstore-test', 'custom.md', '# Custom')

      const docs = await engine.docList('docstore-test')
      expect(docs).toContain('custom.md')
      expect(docs).not.toContain('packet.md')
      expect(docs).not.toContain('workflow.md')
      expect(docs).not.toContain('lessons.md')
    })

    it('docRead throws for nonexistent doc', async () => {
      await engine.seed('docstore-missing')
      await expect(engine.docRead('docstore-missing', 'nope.md')).rejects.toThrow()
    })

    it('docLink throws for nonexistent doc', async () => {
      await engine.seed('docstore-link-fail')
      await engine.nodeUpdate('docstore-link-fail', 'work-1', 'active', 'Working')
      await expect(engine.docLink('docstore-link-fail', 'nope.md', 'work-1')).rejects.toThrow('Document not found')
    })

    it('nested doc creation works', async () => {
      await engine.seed('docstore-nested')
      await engine.docCreate('docstore-nested', 'a/b/c/deep.md', '# Deep doc')

      const content = await engine.docRead('docstore-nested', 'a/b/c/deep.md')
      expect(content).toContain('# Deep doc')

      const docs = await engine.docList('docstore-nested')
      expect(docs).toContain('a/b/c/deep.md')
    })
  })

  describe('template system', () => {
    it('dev-packet template creates all expected files', async () => {
      await engine.seed('tmpl-dev', { template: 'dev-packet' })

      expect(await fs.exists('.context/packets/active/tmpl-dev/packet.md')).toBe(true)
      expect(await fs.exists('.context/packets/active/tmpl-dev/workflow.md')).toBe(true)
      expect(await fs.exists('.context/packets/active/tmpl-dev/lessons.md')).toBe(true)

      const wf = await fs.read('.context/packets/active/tmpl-dev/workflow.md')
      expect(wf).toContain('research/')
      expect(wf).toContain('design/')
      expect(wf).toContain('implementation/')
      expect(wf).toContain('verification/')
    })

    it('bug-fix template creates correct structure', async () => {
      await engine.seed('tmpl-bug', { template: 'bug-fix' })

      const wf = await fs.read('.context/packets/active/tmpl-bug/workflow.md')
      expect(wf).toContain('repro/')
      expect(wf).toContain('analysis/')
      expect(wf).toContain('fix/')
      expect(wf).toContain('verification/')
    })

    it('unknown template seeds without error (no template files)', async () => {
      await engine.seed('tmpl-unknown', { template: 'nonexistent-template' })

      // Should still have packet.md and lessons.md
      expect(await fs.exists('.context/packets/active/tmpl-unknown/packet.md')).toBe(true)
      expect(await fs.exists('.context/packets/active/tmpl-unknown/lessons.md')).toBe(true)
      // No workflow.md since template doesn't exist
      expect(await fs.exists('.context/packets/active/tmpl-unknown/workflow.md')).toBe(false)
    })

    it('listTemplates includes built-ins', async () => {
      const templates = await engine.listTemplates()
      expect(templates).toContain('dev-packet')
      expect(templates).toContain('bug-fix')
    })
  })

  describe('multi-packet with MikroORM', () => {
    it('multiple packets coexist with isolated data', async () => {
      await engine.seed('packet-a')
      await engine.seed('packet-b')

      await engine.nodeUpdate('packet-a', 'node-a', 'active', 'A content')
      await engine.nodeUpdate('packet-b', 'node-b', 'active', 'B content')

      const nodesA = await engine.getNodeContents('packet-a')
      const nodesB = await engine.getNodeContents('packet-b')

      expect(nodesA.find(n => n.id === 'node-a')).toBeDefined()
      expect(nodesA.find(n => n.id === 'node-b')).toBeUndefined()
      expect(nodesB.find(n => n.id === 'node-b')).toBeDefined()
      expect(nodesB.find(n => n.id === 'node-a')).toBeUndefined()
    })

    it('active packet switching works', async () => {
      await engine.seed('switch-a')
      await engine.seed('switch-b') // this becomes active

      expect(await db.getActivePacket()).toBe('switch-b')

      await db.setActivePacket('switch-a')
      expect(await db.getActivePacket()).toBe('switch-a')
    })

    it('deletePacket removes all associated data', async () => {
      await engine.seed('to-delete')
      await engine.nodeUpdate('to-delete', 'work-1', 'active', 'Working')
      await engine.edgeAdd('to-delete', 'work-1', 'work-1')

      await db.deletePacket('to-delete')

      expect(await db.getPacketMeta('to-delete')).toBeNull()
      expect(await db.getDeltas('to-delete')).toEqual([])
      expect(await db.getAllEdges('to-delete')).toEqual([])
    })
  })
})
