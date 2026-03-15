import { describe, it, expect, beforeEach } from 'vitest'
import { blockRegistry } from '../../src/blocks/registry'
import { registerCoreBlocks } from '../../src/blocks/core'
import { validateBlockYaml } from '../../src/blocks/validation'
import { parseMarkdownBlocks } from '../../src/blocks/markdown'
import {
  registerTimelineBlock,
  timelineBlockDefinition,
} from '../../src/plugins/timeline'
import { parseDateMs, formatDateLabel, TIMELINE_STATUS_COLORS } from '../../src/plugins/timeline/types'
import type { TimelineData } from '../../src/plugins/timeline/types'

beforeEach(() => {
  blockRegistry.clear()
  registerCoreBlocks()
  registerTimelineBlock()
})

// ============================================================================
// parseDateMs
// ============================================================================

describe('parseDateMs', () => {
  it('parses a valid YYYY-MM-DD date to UTC midnight', () => {
    const ms = parseDateMs('2026-03-15')
    expect(isNaN(ms)).toBe(false)
    const d = new Date(ms)
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(2) // March = index 2
    expect(d.getUTCDate()).toBe(15)
  })

  it('returns NaN for invalid format', () => {
    expect(isNaN(parseDateMs('not-a-date'))).toBe(true)
    expect(isNaN(parseDateMs('2026/03/15'))).toBe(true)
    expect(isNaN(parseDateMs(''))).toBe(true)
  })

  it('earlier date has smaller ms value', () => {
    const a = parseDateMs('2026-03-01')
    const b = parseDateMs('2026-04-01')
    expect(a).toBeLessThan(b)
  })

  it('handles first day of year', () => {
    const ms = parseDateMs('2026-01-01')
    expect(isNaN(ms)).toBe(false)
    const d = new Date(ms)
    expect(d.getUTCMonth()).toBe(0)
    expect(d.getUTCDate()).toBe(1)
  })
})

// ============================================================================
// formatDateLabel
// ============================================================================

describe('formatDateLabel', () => {
  it('formats March 1 correctly', () => {
    const ms = parseDateMs('2026-03-01')
    const label = formatDateLabel(ms)
    expect(label).toContain('Mar')
    expect(label).toContain('1')
  })

  it('formats December 31 correctly', () => {
    const ms = parseDateMs('2026-12-31')
    const label = formatDateLabel(ms)
    expect(label).toContain('Dec')
    expect(label).toContain('31')
  })
})

// ============================================================================
// Phase ordering — dates determine visual layout, not array order
// ============================================================================

describe('phase date calculations', () => {
  it('earlier start date has smaller ms than later start', () => {
    const phase1Start = parseDateMs('2026-03-01')
    const phase2Start = parseDateMs('2026-03-15')
    expect(phase1Start).toBeLessThan(phase2Start)
  })

  it('phase width is proportional to duration', () => {
    // Phase A: 15 days, Phase B: 30 days — B should be 2x the width
    const totalMs = parseDateMs('2026-04-30') - parseDateMs('2026-03-01')
    const phaseAMs = parseDateMs('2026-03-15') - parseDateMs('2026-03-01')
    const phaseBMs = parseDateMs('2026-04-15') - parseDateMs('2026-03-15')
    const widthA = (phaseAMs / totalMs) * 100
    const widthB = (phaseBMs / totalMs) * 100
    // B (31 days) should be about 2x A (14 days)
    expect(widthB / widthA).toBeGreaterThan(1.8)
  })
})

// ============================================================================
// Status colors
// ============================================================================

describe('TIMELINE_STATUS_COLORS', () => {
  it('defines colors for all four statuses', () => {
    expect(TIMELINE_STATUS_COLORS.done).toBeDefined()
    expect(TIMELINE_STATUS_COLORS['in-progress']).toBeDefined()
    expect(TIMELINE_STATUS_COLORS.todo).toBeDefined()
    expect(TIMELINE_STATUS_COLORS.blocked).toBeDefined()
  })

  it('all colors are valid hex strings', () => {
    for (const color of Object.values(TIMELINE_STATUS_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('done uses green', () => {
    // Green: high green component in the middle two bytes
    const hex = TIMELINE_STATUS_COLORS.done.slice(1)
    const g = parseInt(hex.slice(2, 4), 16)
    const r = parseInt(hex.slice(0, 2), 16)
    expect(g).toBeGreaterThan(r) // green > red for a green color
  })

  it('blocked uses red', () => {
    const hex = TIMELINE_STATUS_COLORS.blocked.slice(1)
    const r = parseInt(hex.slice(0, 2), 16)
    expect(r).toBeGreaterThan(200) // high red component
  })
})

// ============================================================================
// Registration
// ============================================================================

describe('timeline block registration', () => {
  it('registers with type "timeline"', () => {
    expect(blockRegistry.has('timeline')).toBe(true)
    expect(blockRegistry.get('timeline')?.name).toBe('Timeline')
  })

  it('has inline and card components', () => {
    expect(timelineBlockDefinition.components?.inline).toBeDefined()
    expect(timelineBlockDefinition.components?.card).toBeDefined()
  })

  it('registerOrReplace upgrades core stub', () => {
    blockRegistry.clear()
    registerCoreBlocks()
    const stub = blockRegistry.get('timeline')
    expect(stub?.components).toBeUndefined() // stub has no components
    registerTimelineBlock()
    const full = blockRegistry.get('timeline')
    expect(full?.components?.card).toBeDefined()
  })
})

// ============================================================================
// Parsing via validateBlockYaml
// ============================================================================

describe('validateBlockYaml — timeline blocks', () => {
  const fullExample = [
    'title: Project Roadmap',
    'phases:',
    '  - name: Phase 1 - Foundation',
    '    start: "2026-03-01"',
    '    end: "2026-03-15"',
    '    status: done',
    '    tasks:',
    '      - title: Set up infrastructure',
    '        status: done',
    '      - title: Design data model',
    '        status: done',
    '  - name: Phase 2 - Core Features',
    '    start: "2026-03-15"',
    '    end: "2026-04-01"',
    '    status: in-progress',
    '    tasks:',
    '      - title: Build API',
    '        status: in-progress',
    '      - title: Create UI components',
    '        status: todo',
    '  - name: Phase 3 - Polish',
    '    start: "2026-04-01"',
    '    end: "2026-04-15"',
    '    status: todo',
  ].join('\n')

  it('parses the full example without errors', () => {
    const result = validateBlockYaml('timeline', fullExample)
    expect(result.errors).toHaveLength(0)
    const data = result.data as TimelineData
    expect(data.title).toBe('Project Roadmap')
    expect(data.phases).toHaveLength(3)
  })

  it('parses phase names', () => {
    const result = validateBlockYaml('timeline', fullExample)
    const data = result.data as TimelineData
    expect(data.phases[0].name).toBe('Phase 1 - Foundation')
    expect(data.phases[1].name).toBe('Phase 2 - Core Features')
    expect(data.phases[2].name).toBe('Phase 3 - Polish')
  })

  it('parses phase start and end dates', () => {
    const result = validateBlockYaml('timeline', fullExample)
    const data = result.data as TimelineData
    expect(data.phases[0].start).toBe('2026-03-01')
    expect(data.phases[0].end).toBe('2026-03-15')
    expect(data.phases[1].start).toBe('2026-03-15')
    expect(data.phases[1].end).toBe('2026-04-01')
    expect(data.phases[2].start).toBe('2026-04-01')
    expect(data.phases[2].end).toBe('2026-04-15')
  })

  it('parses phase statuses', () => {
    const result = validateBlockYaml('timeline', fullExample)
    const data = result.data as TimelineData
    expect(data.phases[0].status).toBe('done')
    expect(data.phases[1].status).toBe('in-progress')
    expect(data.phases[2].status).toBe('todo')
  })

  it('parses tasks within phases', () => {
    const result = validateBlockYaml('timeline', fullExample)
    const data = result.data as TimelineData
    expect(data.phases[0].tasks).toHaveLength(2)
    expect(data.phases[0].tasks[0]).toEqual({ title: 'Set up infrastructure', status: 'done' })
    expect(data.phases[0].tasks[1]).toEqual({ title: 'Design data model', status: 'done' })
    expect(data.phases[1].tasks[0]).toEqual({ title: 'Build API', status: 'in-progress' })
    expect(data.phases[1].tasks[1]).toEqual({ title: 'Create UI components', status: 'todo' })
  })

  it('phases with no tasks produce empty task arrays', () => {
    const result = validateBlockYaml('timeline', fullExample)
    const data = result.data as TimelineData
    expect(data.phases[2].tasks).toHaveLength(0)
  })

  it('title is optional', () => {
    const source = [
      'phases:',
      '  - name: Only Phase',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: done',
    ].join('\n')
    const result = validateBlockYaml('timeline', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as TimelineData
    expect(data.title).toBeUndefined()
  })

  it('returns error for missing phases list', () => {
    const result = validateBlockYaml('timeline', 'title: No Phases')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toBeNull()
  })

  it('returns error for non-mapping input', () => {
    const result = validateBlockYaml('timeline', '- just a list')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toBeNull()
  })

  it('returns error when all phases have invalid dates', () => {
    const source = [
      'phases:',
      '  - name: Bad Phase',
      '    start: not-a-date',
      '    end: also-not-a-date',
      '    status: todo',
    ].join('\n')
    const result = validateBlockYaml('timeline', source)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toBeNull()
  })

  it('defaults unknown status to "todo"', () => {
    const source = [
      'phases:',
      '  - name: Phase A',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: flying-saucer',
    ].join('\n')
    const result = validateBlockYaml('timeline', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as TimelineData
    expect(data.phases[0].status).toBe('todo')
  })

  it('normalizes in_progress with underscore', () => {
    const source = [
      'phases:',
      '  - name: Phase A',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: in_progress',
    ].join('\n')
    const result = validateBlockYaml('timeline', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as TimelineData
    expect(data.phases[0].status).toBe('in-progress')
  })

  it('accepts all four valid statuses', () => {
    for (const status of ['done', 'in-progress', 'todo', 'blocked']) {
      const source = [
        'phases:',
        `  - name: Phase`,
        `    start: "2026-03-01"`,
        `    end: "2026-03-15"`,
        `    status: ${status}`,
      ].join('\n')
      const result = validateBlockYaml('timeline', source)
      expect(result.errors).toHaveLength(0)
      const data = result.data as TimelineData
      expect(data.phases[0].status).toBe(status)
    }
  })

  it('preserves declaration order of phases', () => {
    const source = [
      'phases:',
      '  - name: First',
      '    start: "2026-04-01"',
      '    end: "2026-04-15"',
      '    status: todo',
      '  - name: Second',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: done',
    ].join('\n')
    const result = validateBlockYaml('timeline', source)
    const data = result.data as TimelineData
    expect(data.phases[0].name).toBe('First')
    expect(data.phases[1].name).toBe('Second')
  })

  it('defaults missing task status to "todo"', () => {
    const source = [
      'phases:',
      '  - name: Phase A',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: done',
      '    tasks:',
      '      - title: A task with no status',
    ].join('\n')
    const result = validateBlockYaml('timeline', source)
    expect(result.errors).toHaveLength(0)
    const data = result.data as TimelineData
    expect(data.phases[0].tasks[0].status).toBe('todo')
  })

  it('skips tasks with no title', () => {
    const source = [
      'phases:',
      '  - name: Phase A',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: done',
      '    tasks:',
      '      - title: Valid task',
      '        status: done',
      '      - status: done',
    ].join('\n')
    const result = validateBlockYaml('timeline', source)
    const data = result.data as TimelineData
    expect(data.phases[0].tasks).toHaveLength(1)
    expect(data.phases[0].tasks[0].title).toBe('Valid task')
  })
})

// ============================================================================
// Integration with parseMarkdownBlocks
// ============================================================================

describe('parseMarkdownBlocks integration', () => {
  it('extracts timeline blocks from markdown', () => {
    const md = [
      '# Roadmap',
      '',
      '```timeline',
      'title: Project Roadmap',
      'phases:',
      '  - name: Phase 1',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: done',
      '```',
      '',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'roadmap.md')
    expect(result.errors).toHaveLength(0)
    expect(result.blocks).toHaveLength(1)

    const block = result.blocks[0]
    expect(block.type).toBe('timeline')
    expect(block.data).not.toBeNull()

    const data = block.data as TimelineData
    expect(data.title).toBe('Project Roadmap')
    expect(data.phases).toHaveLength(1)
    expect(data.phases[0].name).toBe('Phase 1')
  })

  it('extracts a timeline block with tilde fence', () => {
    const md = [
      '~~~timeline',
      'phases:',
      '  - name: Release 1.0',
      '    start: "2026-03-01"',
      '    end: "2026-04-01"',
      '    status: in-progress',
      '~~~',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'release.md')
    expect(result.errors).toHaveLength(0)
    expect(result.blocks).toHaveLength(1)

    const data = result.blocks[0].data as TimelineData
    expect(data.phases[0].status).toBe('in-progress')
  })

  it('preserves source information for timeline blocks', () => {
    const md = [
      '# Title',
      '',
      '```timeline',
      'phases:',
      '  - name: Phase 1',
      '    start: "2026-03-01"',
      '    end: "2026-03-15"',
      '    status: done',
      '```',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'sourced.md')
    const source = result.blocks[0].source
    expect(source.filePath).toBe('sourced.md')
    expect(source.range.startLine).toBeGreaterThan(0)
    expect(source.range.endLine).toBeGreaterThan(0)
    expect(source.raw).toContain('```timeline')
  })

  it('reports errors for invalid timeline blocks in markdown', () => {
    const md = [
      '```timeline',
      'title: No Phases Here',
      '```',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'bad.md')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].data).toBeNull()
    expect(result.blocks[0].errors).toBeDefined()
    expect(result.blocks[0].errors!.length).toBeGreaterThan(0)
  })
})
