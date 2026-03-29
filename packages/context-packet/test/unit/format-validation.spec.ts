import { describe, it, expect } from 'vitest'
import {
  parseWorkflow,
  evaluateGate,
  evaluateWorkflow,
  type FormatDefinition,
  type GateEvalContext,
} from '../../src/workflow'

describe('Format validation', () => {
  describe('parseWorkflow formats section', () => {
    it('parses format definitions with required sections and blocks', () => {
      const schema = parseWorkflow(`# Workflow: Test

## Formats

### brand-profile
required-sections: [Brand Identity, Target Audience, Tone of Voice]
required-blocks: [question]

### competitor-analysis
required-sections: [Overview, Pricing, Strengths, Weaknesses]
required-blocks: [question, checklist]
required-block-counts:
  question: 2
  checklist: 1

## Stages

### discovery
inputs: []
outputs:
  - discovery/brand.md (format: brand-profile)
gates:
  - file-exists discovery/brand.md
`)

      expect(schema.formats.size).toBe(2)

      const brand = schema.formats.get('brand-profile')!
      expect(brand.name).toBe('brand-profile')
      expect(brand.requiredSections).toEqual(['Brand Identity', 'Target Audience', 'Tone of Voice'])
      expect(brand.requiredBlocks).toEqual(['question'])

      const comp = schema.formats.get('competitor-analysis')!
      expect(comp.requiredSections).toEqual(['Overview', 'Pricing', 'Strengths', 'Weaknesses'])
      expect(comp.requiredBlocks).toEqual(['question', 'checklist'])
      expect(comp.requiredBlockCounts).toEqual({ question: 2, checklist: 1 })
    })

    it('auto-generates format-valid gates from outputs with format refs', () => {
      const schema = parseWorkflow(`# Workflow: Test

## Formats

### profile
required-sections: [Name, Bio]

## Stages

### build
inputs: []
outputs:
  - output/profile.md (format: profile)
gates:
  - file-exists output/profile.md
`)

      const buildStage = schema.stages.find(s => s.name === 'build')!
      const formatGate = buildStage.gates.find(g => g.type === 'format-valid')
      expect(formatGate).toBeDefined()
      expect(formatGate!.scope).toBe('output/profile.md')
      expect(formatGate!.format).toBe('profile')
    })
  })

  describe('evaluateGate format-valid', () => {
    const makeCtx = (files: Record<string, string>, formats: Map<string, FormatDefinition>): GateEvalContext => ({
      readFile: async (path) => files[path] ?? null,
      fileExists: async (path) => path in files,
      listFiles: async () => Object.keys(files),
      formats,
    })

    it('passes when all required sections are present', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['profile', { name: 'profile', requiredSections: ['Name', 'Bio'] }],
      ])
      const ctx = makeCtx({
        'output.md': '# Profile\n\n## Name\nJohn\n\n## Bio\nDeveloper.',
      }, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'output.md', format: 'profile' },
        ctx,
      )
      expect(result.passed).toBe(true)
    })

    it('fails when a required section is missing', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['profile', { name: 'profile', requiredSections: ['Name', 'Bio', 'Contact'] }],
      ])
      const ctx = makeCtx({
        'output.md': '# Profile\n\n## Name\nJohn\n\n## Bio\nDeveloper.',
      }, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'output.md', format: 'profile' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('Missing section: Contact')
    })

    it('passes when required blocks are present', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['research', { name: 'research', requiredBlocks: ['question'] }],
      ])
      const ctx = makeCtx({
        'doc.md': '# Research\n\n~~~question\nid: q1\n---\nWhat approach?\n~~~',
      }, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'research' },
        ctx,
      )
      expect(result.passed).toBe(true)
    })

    it('fails when required blocks are missing', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['research', { name: 'research', requiredBlocks: ['question', 'checklist'] }],
      ])
      const ctx = makeCtx({
        'doc.md': '# Research\n\nJust text, no blocks.',
      }, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'research' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('Requires 1 question block(s), found 0')
      expect(result.detail).toContain('Requires 1 checklist block(s), found 0')
    })

    it('checks block counts when specified', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['detailed', {
          name: 'detailed',
          requiredBlocks: ['question'],
          requiredBlockCounts: { question: 3 },
        }],
      ])
      const ctx = makeCtx({
        'doc.md': '# Doc\n\n~~~question\nid: q1\n---\nQ1\n~~~\n\n~~~question\nid: q2\n---\nQ2\n~~~',
      }, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'detailed' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('Requires 3 question block(s), found 2')
    })

    it('passes with exact block count', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['brief', {
          name: 'brief',
          requiredBlocks: ['question'],
          requiredBlockCounts: { question: 2 },
        }],
      ])
      const ctx = makeCtx({
        'doc.md': '# Doc\n\n~~~question\nid: q1\n---\nQ1\n~~~\n\n~~~question\nid: q2\n---\nQ2\n~~~',
      }, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'brief' },
        ctx,
      )
      expect(result.passed).toBe(true)
    })

    it('fails when file does not exist', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['profile', { name: 'profile', requiredSections: ['Name'] }],
      ])
      const ctx = makeCtx({}, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'missing.md', format: 'profile' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('not found')
    })

    it('fails when format is not defined', async () => {
      const ctx = makeCtx({ 'doc.md': '# Doc' }, new Map())

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'nonexistent' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('not defined')
    })

    it('uses custom validator when provided', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['custom', {
          name: 'custom',
          validate: (content) => ({
            valid: content.includes('REQUIRED_MARKER'),
            errors: content.includes('REQUIRED_MARKER') ? [] : ['Missing REQUIRED_MARKER'],
            warnings: [],
          }),
        }],
      ])

      const failCtx = makeCtx({ 'doc.md': '# No marker' }, formats)
      const failResult = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'custom' },
        failCtx,
      )
      expect(failResult.passed).toBe(false)
      expect(failResult.detail).toContain('Missing REQUIRED_MARKER')

      const passCtx = makeCtx({ 'doc.md': '# Has REQUIRED_MARKER here' }, formats)
      const passResult = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'custom' },
        passCtx,
      )
      expect(passResult.passed).toBe(true)
    })

    it('checks both sections and blocks together', async () => {
      const formats = new Map<string, FormatDefinition>([
        ['full', {
          name: 'full',
          requiredSections: ['Overview', 'Details'],
          requiredBlocks: ['question'],
        }],
      ])

      // Has sections but missing block
      const ctx = makeCtx({
        'doc.md': '# Doc\n\n## Overview\nText.\n\n## Details\nMore text.',
      }, formats)

      const result = await evaluateGate(
        { type: 'format-valid', scope: 'doc.md', format: 'full' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.detail).toContain('question')
      expect(result.detail).not.toContain('Missing section') // sections are fine
    })
  })

  describe('end-to-end workflow with format validation', () => {
    it('stage completion requires valid format', async () => {
      const schema = parseWorkflow(`# Workflow: Test

## Formats

### research-doc
required-sections: [Findings, Conclusion]
required-blocks: [question]

## Stages

### research
inputs: []
outputs:
  - research/findings.md (format: research-doc)
gates:
  - file-exists research/findings.md
`)

      // Invalid doc — missing Conclusion section and question block
      const ctx: GateEvalContext = {
        readFile: async (path) => {
          if (path === 'research/findings.md') return '# Research\n\n## Findings\nSome findings.'
          return null
        },
        fileExists: async (path) => path === 'research/findings.md',
        listFiles: async () => ['research/findings.md'],
      }

      const statuses = await evaluateWorkflow(schema, ctx)
      const research = statuses.find(s => s.name === 'research')!

      // file-exists passes, but format-valid fails
      expect(research.complete).toBe(false)
      const formatGate = research.gateDetails.find(g => g.gate.type === 'format-valid')
      expect(formatGate?.passed).toBe(false)
      expect(formatGate?.detail).toContain('Missing section: Conclusion')
    })

    it('stage completes when format is valid', async () => {
      const schema = parseWorkflow(`# Workflow: Test

## Formats

### research-doc
required-sections: [Findings, Conclusion]

## Stages

### research
inputs: []
outputs:
  - research/findings.md (format: research-doc)
gates:
  - file-exists research/findings.md
`)

      const ctx: GateEvalContext = {
        readFile: async (path) => {
          if (path === 'research/findings.md') return '# Research\n\n## Findings\nGood stuff.\n\n## Conclusion\nDone.'
          return null
        },
        fileExists: async (path) => path === 'research/findings.md',
        listFiles: async () => ['research/findings.md'],
      }

      const statuses = await evaluateWorkflow(schema, ctx)
      const research = statuses.find(s => s.name === 'research')!
      expect(research.complete).toBe(true)
    })
  })
})
