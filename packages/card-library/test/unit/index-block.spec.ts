import { describe, it, expect, beforeEach } from 'vitest'
import { blockRegistry } from '../../src/blocks/registry'
import { registerCoreBlocks } from '../../src/blocks/core'
import { validateBlockYaml } from '../../src/blocks/validation'
import { parseMarkdownBlocks } from '../../src/blocks/markdown'
import { registerIndexBlock } from '../../src/plugins/index'
import { parseIndexBlock, EntityRegistry } from '../../src/plugins/index/parser'
import { parseEntityId, parseFileRef } from '../../src/plugins/index/types'
import type { IndexBlockData } from '../../src/plugins/index/types'
import type { ContextLinkEntry, PipelineEntry } from '../../src/plugins/index/types'

beforeEach(() => {
  blockRegistry.clear()
  registerCoreBlocks()
  registerIndexBlock()
})

// ---------------------------------------------------------------------------
// Entity ID parsing
// ---------------------------------------------------------------------------

describe('parseEntityId', () => {
  it('parses single-char prefix IDs', () => {
    expect(parseEntityId('F1')).toEqual({ type: 'file', num: 1 })
    expect(parseEntityId('S3')).toEqual({ type: 'system', num: 3 })
    expect(parseEntityId('I12')).toEqual({ type: 'interface', num: 12 })
    expect(parseEntityId('P2')).toEqual({ type: 'problem', num: 2 })
  })

  it('parses multi-char prefix IDs', () => {
    expect(parseEntityId('PF1')).toEqual({ type: 'pipeline', num: 1 })
    expect(parseEntityId('CS3')).toEqual({ type: 'snippet', num: 3 })
    expect(parseEntityId('DS7')).toEqual({ type: 'doc', num: 7 })
    expect(parseEntityId('CL2')).toEqual({ type: 'link', num: 2 })
  })

  it('returns null for invalid IDs', () => {
    expect(parseEntityId('X1')).toBeNull()
    expect(parseEntityId('abc')).toBeNull()
    expect(parseEntityId('')).toBeNull()
    expect(parseEntityId('F')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// File reference parsing
// ---------------------------------------------------------------------------

describe('parseFileRef', () => {
  it('parses file ref with line range', () => {
    expect(parseFileRef('F1>42-60')).toEqual({
      fileId: 'F1', startLine: 42, endLine: 60,
    })
  })

  it('parses file ref with single line', () => {
    expect(parseFileRef('F1>42')).toEqual({
      fileId: 'F1', startLine: 42,
    })
  })

  it('parses file ref with description', () => {
    expect(parseFileRef('F1>42-60:Token validation')).toEqual({
      fileId: 'F1', startLine: 42, endLine: 60, description: 'Token validation',
    })
  })

  it('parses file ref with @CODE@ marker', () => {
    expect(parseFileRef('F1>42-60:@CODE@')).toEqual({
      fileId: 'F1', startLine: 42, endLine: 60, expandable: '@CODE@',
    })
  })

  it('parses file ref with description and @CODE@', () => {
    expect(parseFileRef('F1>42-60:Token check@CODE@')).toEqual({
      fileId: 'F1', startLine: 42, endLine: 60,
      description: 'Token check', expandable: '@CODE@',
    })
  })

  it('parses file ref with @MARKDOWN@ marker', () => {
    expect(parseFileRef('F8>50-100:@MARKDOWN@')).toEqual({
      fileId: 'F8', startLine: 50, endLine: 100, expandable: '@MARKDOWN@',
    })
  })

  it('parses bare entity ID', () => {
    expect(parseFileRef('F1')).toEqual({ fileId: 'F1' })
  })

  it('returns null for invalid refs', () => {
    expect(parseFileRef('not-a-ref')).toBeNull()
    expect(parseFileRef('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Index block parsing
// ---------------------------------------------------------------------------

const SAMPLE_INDEX = `# FILE_PATHS
F1:src/auth/token.ts
F2:src/auth/session.ts
F3:src/api/routes.ts

# SYSTEMS
S1:AUTH_SYSTEM|Authentication and session management|
F1>42-60:Token validation
F2>10-30:Session store

S2:API_GATEWAY|Request routing and middleware|
F3>1-50:Route definitions

# CRITICAL_INTERFACES
I1:AUTH_REQUEST|Authenticated request type|
F1>5-20:Type definition

# PROBLEM_AREAS
P1:TOKEN_EXPIRY|Tokens not refreshing on time|
F1>100-120:Expiry check@CODE@

# PIPELINE_FLOWS
PF1:AUTH_FLOW|F1>Validate token>F2>Check session>F1>Return user

# CODE_SNIPPETS
CS1:TOKEN_CHECK|Core token validation logic|
F1>42-60:@CODE@

# CONTEXT_LINKS
CL1:AUTH_SYSTEM_FULL|
S1:AUTH_SYSTEM
I1:AUTH_REQUEST
P1:TOKEN_EXPIRY
CS1:TOKEN_CHECK
PF1:AUTH_FLOW`

describe('parseIndexBlock', () => {
  it('parses all sections', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    expect(result.sections).toHaveLength(7)
    expect(result.sections.map(s => s.header)).toEqual([
      'FILE_PATHS', 'SYSTEMS', 'CRITICAL_INTERFACES',
      'PROBLEM_AREAS', 'PIPELINE_FLOWS', 'CODE_SNIPPETS',
      'CONTEXT_LINKS',
    ])
  })

  it('parses FILE_PATHS correctly', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    expect(result.registry.files.size).toBe(3)
    expect(result.registry.files.get('F1')).toBe('src/auth/token.ts')
    expect(result.registry.files.get('F2')).toBe('src/auth/session.ts')
    expect(result.registry.files.get('F3')).toBe('src/api/routes.ts')
  })

  it('parses SYSTEMS with refs', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    const s1 = result.registry.entities.get('S1')
    expect(s1).toBeDefined()
    expect(s1!.type).toBe('system')
    expect(s1!.name).toBe('AUTH_SYSTEM')
    expect(s1!.description).toBe('Authentication and session management')
    expect(s1!.refs).toHaveLength(2)
    expect(s1!.refs[0]).toEqual({ fileId: 'F1', startLine: 42, endLine: 60, description: 'Token validation' })
    expect(s1!.refs[1]).toEqual({ fileId: 'F2', startLine: 10, endLine: 30, description: 'Session store' })
  })

  it('parses INTERFACES', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    const i1 = result.registry.entities.get('I1')
    expect(i1).toBeDefined()
    expect(i1!.type).toBe('interface')
    expect(i1!.name).toBe('AUTH_REQUEST')
  })

  it('parses PROBLEM_AREAS with expandable markers', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    const p1 = result.registry.entities.get('P1')
    expect(p1).toBeDefined()
    expect(p1!.refs[0].expandable).toBe('@CODE@')
  })

  it('parses PIPELINE_FLOWS', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    const pf1 = result.registry.entities.get('PF1') as PipelineEntry
    expect(pf1).toBeDefined()
    expect(pf1.type).toBe('pipeline')
    expect(pf1.steps).toHaveLength(3)
    expect(pf1.steps[0]).toEqual({ fileId: 'F1', description: 'Validate token' })
    expect(pf1.steps[1]).toEqual({ fileId: 'F2', description: 'Check session' })
    expect(pf1.steps[2]).toEqual({ fileId: 'F1', description: 'Return user' })
  })

  it('parses CONTEXT_LINKS', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    const cl1 = result.registry.entities.get('CL1') as ContextLinkEntry
    expect(cl1).toBeDefined()
    expect(cl1.type).toBe('link')
    expect(cl1.name).toBe('AUTH_SYSTEM_FULL')
    expect(cl1.linkedIds).toEqual(['S1', 'I1', 'P1', 'CS1', 'PF1'])
  })

  it('total entity count', () => {
    const result = parseIndexBlock(SAMPLE_INDEX)
    // 3 files + 2 systems + 1 interface + 1 problem + 1 pipeline + 1 snippet + 1 link = 10
    expect(result.registry.entities.size).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// EntityRegistry query operations
// ---------------------------------------------------------------------------

describe('EntityRegistry', () => {
  let registry: EntityRegistry

  beforeEach(() => {
    const data = parseIndexBlock(SAMPLE_INDEX)
    registry = new EntityRegistry(data.registry)
  })

  it('gets entity by ID', () => {
    expect(registry.get('S1')?.name).toBe('AUTH_SYSTEM')
    expect(registry.get('NONEXISTENT')).toBeUndefined()
  })

  it('has check', () => {
    expect(registry.has('F1')).toBe(true)
    expect(registry.has('Z99')).toBe(false)
  })

  it('gets file path', () => {
    expect(registry.filePath('F1')).toBe('src/auth/token.ts')
    expect(registry.filePath('F99')).toBeUndefined()
  })

  it('filters by type', () => {
    expect(registry.byType('file')).toHaveLength(3)
    expect(registry.byType('system')).toHaveLength(2)
    expect(registry.byType('pipeline')).toHaveLength(1)
  })

  it('CONTEXT query: finds linked entities', () => {
    // S1 is linked through CL1 to I1, P1, CS1, PF1
    const ctx = registry.context('S1')
    const ids = ctx.map(e => e.id).sort()
    expect(ids).toEqual(['CS1', 'I1', 'P1', 'PF1'])
  })

  it('CONTEXT query: returns empty for unlinked entity', () => {
    expect(registry.context('S2')).toHaveLength(0)
  })

  it('FIND_REFS query: finds entities referencing a file', () => {
    // F1 is referenced by S1 (42-60), I1 (5-20), P1 (100-120), CS1 (42-60)
    // Also PF1 step chain
    const refs = registry.findRefs('F1')
    const ids = refs.map(e => e.id).sort()
    expect(ids).toContain('S1')
    expect(ids).toContain('I1')
    expect(ids).toContain('P1')
    expect(ids).toContain('CS1')
    expect(ids).toContain('PF1')
  })

  it('FIND_REFS query: filters by line', () => {
    // F1>42-60 is referenced by S1 and CS1
    const refs = registry.findRefs('F1', 50)
    const ids = refs.map(e => e.id)
    expect(ids).toContain('S1')
    expect(ids).toContain('CS1')
    // P1 references F1>100-120, so line 50 shouldn't match
    expect(ids).not.toContain('P1')
  })

  it('DEEP_EXPAND query: expands context link', () => {
    const expanded = registry.deepExpand('CL1')
    const ids = expanded.map(e => e.id).sort()
    expect(ids).toEqual(['CS1', 'I1', 'P1', 'PF1', 'S1'])
  })
})

// ---------------------------------------------------------------------------
// Integration: validateBlockYaml dispatches to index parser
// ---------------------------------------------------------------------------

describe('validateBlockYaml — index blocks', () => {
  it('parses index block via validation pipeline', () => {
    const result = validateBlockYaml('index', SAMPLE_INDEX)
    expect(result.errors).toHaveLength(0)
    expect(result.data).not.toBeNull()

    const data = result.data as IndexBlockData
    expect(data.registry.entities.size).toBe(10)
    expect(data.registry.files.size).toBe(3)
  })

  it('detects invalid file references', () => {
    const badIndex = `# FILE_PATHS
F1:src/file.ts

# SYSTEMS
S1:THING|desc|
F99>10-20:Ghost reference`

    const result = validateBlockYaml('index', badIndex)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].message).toContain('F99')
  })
})

// ---------------------------------------------------------------------------
// Integration: parseMarkdownBlocks finds index blocks in markdown
// ---------------------------------------------------------------------------

describe('parseMarkdownBlocks — index blocks', () => {
  it('finds index block in markdown', () => {
    const md = `# My Docs

Some text here.

\`\`\`index
# FILE_PATHS
F1:src/main.ts

# SYSTEMS
S1:MAIN|Entry point|
F1>1-10:Bootstrap
\`\`\`

More text after.
`

    const result = parseMarkdownBlocks(md, 'test.md')
    const indexBlocks = result.blocks.filter(b => b.type === 'index')
    expect(indexBlocks).toHaveLength(1)

    const data = indexBlocks[0].data as IndexBlockData
    expect(data.registry.files.get('F1')).toBe('src/main.ts')
    expect(data.registry.entities.get('S1')?.name).toBe('MAIN')
  })
})
