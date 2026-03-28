import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PacketEngine } from '../../src/PacketEngine'
import { InMemoryPacketDatabase } from '../../src/storage/InMemoryPacketDatabase'
import { createMockFs } from '../unit/helpers'
import { runCommand } from '../../src/cli/commands'
import { buildContextOutput } from '../../src/cli/context'
import { parseWorkflow, evaluateGate } from '../../src/workflow'
import type { FileService } from '../../src/types'
import type { PacketDatabase } from '../../src/storage/PacketDatabase'

describe('Workflow + Lessons + Templates (integration)', () => {
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

  describe('lessons.md', () => {
    it('seed creates lessons.md automatically', async () => {
      await engine.seed('lesson-test')

      const content = await fs.read('.context/packets/active/lesson-test/lessons.md')
      expect(content).toContain('# Lessons')
    })

    it('lessonAdd appends timestamped entries', async () => {
      await engine.seed('lesson-add')

      await engine.lessonAdd('lesson-add', 'Rate limit is 100 req/s')
      await engine.lessonAdd('lesson-add', 'Use batch API for bulk ops')

      const content = await fs.read('.context/packets/active/lesson-add/lessons.md')
      expect(content).toContain('Rate limit is 100 req/s')
      expect(content).toContain('Use batch API for bulk ops')
      // Should have timestamps
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}\]/)
    })

    it('lessonList returns all lessons', async () => {
      await engine.seed('lesson-list')
      await engine.lessonAdd('lesson-list', 'Lesson one')
      await engine.lessonAdd('lesson-list', 'Lesson two')

      const lessons = await engine.lessonList('lesson-list')
      expect(lessons).toHaveLength(2)
      expect(lessons[0]).toContain('Lesson one')
      expect(lessons[1]).toContain('Lesson two')
    })

    it('CLI: packet lesson add + list', async () => {
      await engine.seed('cli-lesson')

      await runCommand(engine, db, ['lesson', 'add', '--content', 'Test lesson from CLI'])
      expect(JSON.parse(output[output.length - 1]).status).toBe('added')

      output.length = 0
      await runCommand(engine, db, ['lesson', 'list'])
      const lessons = JSON.parse(output[output.length - 1])
      expect(lessons).toHaveLength(1)
      expect(lessons[0]).toContain('Test lesson from CLI')
    })

    it('lessons injected in context output', async () => {
      await engine.seed('lesson-inject', {
        problemVector: { current: 'X', target: 'Y', approach: 'Z' },
      })
      await engine.lessonAdd('lesson-inject', 'Important lesson about auth')

      const mockReader = async (path: string) => fs.read(path)
      const ctx = await buildContextOutput('.context', 'lesson-inject', mockReader)

      expect(ctx).not.toBeNull()
      expect(ctx).toContain('Important lesson about auth')
      expect(ctx).toContain('<lessons>')
    })
  })

  describe('workflow.md', () => {
    it('parseWorkflow parses structure and stages', () => {
      const content = `# Workflow: Test

## Structure
- research/ — exploration
- design/ — architecture

## Stages

### research
inputs: [problem statement]
outputs:
  - research/findings.md (format: research)
gates:
  - all questions in research/*.md answered

### design
inputs: research/*
outputs:
  - design/arch.md (format: design)
gates:
  - checklist in design/arch.md complete
`
      const schema = parseWorkflow(content)

      expect(schema.name).toBe('Test')
      expect(schema.structure).toHaveLength(2)
      expect(schema.structure[0].path).toBe('research')
      expect(schema.stages).toHaveLength(2)
      expect(schema.stages[0].name).toBe('research')
      expect(schema.stages[0].outputs[0].path).toBe('research/findings.md')
      expect(schema.stages[0].gates[0].type).toBe('questions-answered')
      expect(schema.stages[1].gates[0].type).toBe('checklist-complete')
    })

    it('evaluateGate checks file existence', async () => {
      const ctx = {
        readFile: async () => null,
        fileExists: async (path: string) => path === 'repro/steps.md',
        listFiles: async () => [],
      }

      const pass = await evaluateGate({ type: 'file-exists', scope: 'repro/steps.md' }, ctx)
      expect(pass.passed).toBe(true)

      const fail = await evaluateGate({ type: 'file-exists', scope: 'missing.md' }, ctx)
      expect(fail.passed).toBe(false)
    })

    it('evaluateGate checks checklist completion', async () => {
      const ctx = {
        readFile: async (path: string) => {
          if (path === 'plan.md') return '- [x] Step 1\n- [x] Step 2\n- [ ] Step 3'
          return null
        },
        fileExists: async () => true,
        listFiles: async (pattern: string) => {
          if (pattern.includes('plan')) return ['plan.md']
          return []
        },
      }

      const result = await evaluateGate(
        { type: 'checklist-complete', scope: 'plan.md' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('2/3')
    })

    it('evaluateGate checks all items checked', async () => {
      const ctx = {
        readFile: async () => '- [x] Done 1\n- [x] Done 2',
        fileExists: async () => true,
        listFiles: async () => ['plan.md'],
      }

      const result = await evaluateGate(
        { type: 'checklist-complete', scope: 'plan.md' },
        ctx,
      )
      expect(result.passed).toBe(true)
      expect(result.detail).toContain('2/2')
    })

    it('evaluateGate checks questions answered', async () => {
      const ctx = {
        readFile: async () => '~~~question\nid: q1\n---\nWhat auth?\n~~~\n\n~~~question\nid: q2\nresponse: JWT\n---\nWhat tokens?\n~~~',
        fileExists: async () => true,
        listFiles: async () => ['doc.md'],
      }

      const result = await evaluateGate(
        { type: 'questions-answered', scope: '*.md' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('1/2')
    })

    it('CLI: packet workflow status', async () => {
      await engine.seed('wf-status')

      // Write a workflow.md
      await fs.write('.context/packets/active/wf-status/workflow.md', `# Workflow: Test

## Structure
- output/ — deliverables

## Stages

### build
inputs: []
outputs:
  - output/plan.md
gates:
  - file-exists output/plan.md
`)

      await runCommand(engine, db, ['workflow', 'status'])
      const statuses = JSON.parse(output[output.length - 1])
      expect(statuses).toHaveLength(1)
      expect(statuses[0].name).toBe('build')
      expect(statuses[0].complete).toBe(false)

      // Create the expected file
      output.length = 0
      await engine.docCreate('wf-status', 'output/plan.md', '# Plan\n- [x] Done')

      await runCommand(engine, db, ['workflow', 'status'])
      const updated = JSON.parse(output[output.length - 1])
      expect(updated[0].complete).toBe(true)
    })
  })

  describe('templates', () => {
    it('seed --template dev-packet creates workflow.md + folders', async () => {
      await engine.seed('from-template', { template: 'dev-packet' })

      // Workflow should exist
      const workflow = await fs.read('.context/packets/active/from-template/workflow.md')
      expect(workflow).toContain('# Workflow: Development Packet')
      expect(workflow).toContain('research/')
      expect(workflow).toContain('design/')

      // Lessons should exist
      const lessons = await fs.read('.context/packets/active/from-template/lessons.md')
      expect(lessons).toContain('# Lessons')
    })

    it('seed --template bug-fix creates bug-fix structure', async () => {
      await engine.seed('bug', { template: 'bug-fix' })

      const workflow = await fs.read('.context/packets/active/bug/workflow.md')
      expect(workflow).toContain('# Workflow: Bug Fix')
      expect(workflow).toContain('repro/')
      expect(workflow).toContain('fix/')
    })

    it('CLI: packet seed --name test --template dev-packet', async () => {
      await runCommand(engine, db, ['seed', '--name', 'cli-tmpl', '--template', 'dev-packet'])

      const workflow = await fs.read('.context/packets/active/cli-tmpl/workflow.md')
      expect(workflow).toContain('Development Packet')
    })

    it('CLI: packet template list', async () => {
      await engine.seed('any')

      await runCommand(engine, db, ['template', 'list'])
      const templates = JSON.parse(output[output.length - 1])
      expect(templates).toContain('dev-packet')
      expect(templates).toContain('bug-fix')
    })

    it('getWorkflowStatus evaluates template workflow', async () => {
      await engine.seed('eval-wf', { template: 'dev-packet' })

      const statuses = await engine.getWorkflowStatus('eval-wf')
      expect(statuses.length).toBeGreaterThan(0)
      // Stages with file-exists or checklist gates should be incomplete
      // Stages with only questions-answered gates may pass vacuously (0 questions = all answered)
      const fileGateStages = statuses.filter(s =>
        s.gateDetails.some(g => g.gate.type === 'checklist-complete')
      )
      for (const s of fileGateStages) {
        expect(s.complete).toBe(false)
      }
    })
  })

  describe('full lifecycle with workflow', () => {
    it('seed → workflow → work → verify gates', async () => {
      // 1. Seed with template
      await engine.seed('lifecycle', { template: 'bug-fix' })

      // 2. Check initial status — file-exists gates are incomplete
      let statuses = await engine.getWorkflowStatus('lifecycle')
      const reproStageInitial = statuses.find(s => s.name === 'reproduce')
      expect(reproStageInitial?.complete).toBe(false) // file-exists gate

      // 3. Create repro steps (satisfies reproduce stage gate: file-exists)
      await engine.docCreate('lifecycle', 'repro/steps.md', '# Reproduction\n\n1. Click button\n2. See error')

      // 4. Check status — reproduce stage should be complete
      statuses = await engine.getWorkflowStatus('lifecycle')
      const reproStage = statuses.find(s => s.name === 'reproduce')
      expect(reproStage?.complete).toBe(true)

      // 5. Add a lesson
      await engine.lessonAdd('lifecycle', 'The error only happens on Safari')

      // 6. Verify lessons persist
      const lessons = await engine.lessonList('lifecycle')
      expect(lessons[0]).toContain('Safari')
    })
  })
})
