import { describe, it, expect, beforeEach } from 'vitest'
import { blockRegistry } from '../../src/blocks/registry'
import { registerCoreBlocks } from '../../src/blocks/core'
import { validateBlockYaml } from '../../src/blocks/validation'
import { parseMarkdownBlocks } from '../../src/blocks/markdown'
import {
  registerNodeBlock,
  registerNodeMapBlock,
  nodeBlockDefinition,
  nodeMapBlockDefinition,
} from '../../src/plugins/node'
import type { NodeBlockData, NodeMapBlockData } from '../../src/plugins/node/types'

beforeEach(() => {
  blockRegistry.clear()
  registerCoreBlocks()
  registerNodeBlock()
  registerNodeMapBlock()
})

// ---------------------------------------------------------------------------
// Parsing ~~~node blocks
// ---------------------------------------------------------------------------

describe('validateBlockYaml — node blocks', () => {
  it('parses a node block with all fields', () => {
    const source = [
      'id: auth-login',
      'state: active',
      'layer: street',
      'subsystem: auth',
      'maps: auth-symbols',
      '---',
      'Some opaque body content',
      'Second line',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeBlockData
    expect(data.id).toBe('auth-login')
    expect(data.state).toBe('active')
    expect(data.layer).toBe('street')
    expect(data.subsystem).toBe('auth')
    expect(data.maps).toBe('auth-symbols')
    expect(data.body).toBe('Some opaque body content\nSecond line')
  })

  it('parses a minimal node block (id + state + body)', () => {
    const source = [
      'id: minimal-node',
      'state: success',
      '---',
      'body here',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeBlockData
    expect(data.id).toBe('minimal-node')
    expect(data.state).toBe('success')
    expect(data.layer).toBeUndefined()
    expect(data.subsystem).toBeUndefined()
    expect(data.maps).toBeUndefined()
    expect(data.body).toBe('body here')
  })

  it('defaults state to active when not provided', () => {
    const source = [
      'id: default-state',
      '---',
      'body',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeBlockData
    expect(data.state).toBe('active')
  })

  it('rejects missing id', () => {
    const source = [
      'state: active',
      '---',
      'body',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('id')
    expect(result.data).toBeNull()
  })

  it('rejects invalid state', () => {
    const source = [
      'id: bad-state',
      'state: pending',
      '---',
      'body',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('pending')
    expect(result.data).toBeNull()
  })

  it('rejects invalid zoom layer', () => {
    const source = [
      'id: bad-layer',
      'state: active',
      'layer: universe',
      '---',
      'body',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('universe')
    expect(result.data).toBeNull()
  })

  it('handles empty body', () => {
    const source = [
      'id: empty-body',
      'state: active',
      '---',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeBlockData
    expect(data.id).toBe('empty-body')
    expect(data.body).toBe('')
  })

  it('only splits on the first --- separator', () => {
    const source = [
      'id: multi-dash',
      'state: active',
      '---',
      'line one',
      '---',
      'line after second separator',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeBlockData
    expect(data.body).toBe('line one\n---\nline after second separator')
  })

  it('handles multiline body with special content', () => {
    const source = [
      'id: special-body',
      'state: failed',
      '---',
      '\u{1F480} dead path here',
      '\u2713 proven path here',
      'normal line',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeBlockData
    expect(data.body).toContain('\u{1F480} dead path here')
    expect(data.body).toContain('\u2713 proven path here')
  })

  it('handles no separator (header only, empty body)', () => {
    const source = [
      'id: no-sep',
      'state: active',
    ].join('\n')

    const result = validateBlockYaml('node', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeBlockData
    expect(data.id).toBe('no-sep')
    expect(data.body).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Parsing ~~~node-map blocks
// ---------------------------------------------------------------------------

describe('validateBlockYaml — node-map blocks', () => {
  it('parses a node-map block', () => {
    const source = [
      'id: auth-symbols',
      '---',
      'LOGIN = "authentication login flow"',
      'LOGOUT = "authentication logout flow"',
    ].join('\n')

    const result = validateBlockYaml('node-map', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeMapBlockData
    expect(data.id).toBe('auth-symbols')
    expect(data.body).toBe('LOGIN = "authentication login flow"\nLOGOUT = "authentication logout flow"')
  })

  it('rejects missing id', () => {
    const source = [
      '---',
      'some body',
    ].join('\n')

    const result = validateBlockYaml('node-map', source)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('id')
    expect(result.data).toBeNull()
  })

  it('handles empty body in node-map', () => {
    const source = [
      'id: empty-map',
      '---',
    ].join('\n')

    const result = validateBlockYaml('node-map', source)
    expect(result.errors).toHaveLength(0)

    const data = result.data as NodeMapBlockData
    expect(data.id).toBe('empty-map')
    expect(data.body).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('nodeBlockDefinition.serialize', () => {
  it('serializes a full NodeBlockData back to string', () => {
    const data: NodeBlockData = {
      id: 'auth-login',
      state: 'active',
      layer: 'street',
      subsystem: 'auth',
      maps: 'auth-symbols',
      body: 'Some opaque body content\nSecond line',
    }

    const serialized = nodeBlockDefinition.serialize!(data)

    expect(serialized).toBe([
      'id: auth-login',
      'state: active',
      'layer: street',
      'subsystem: auth',
      'maps: auth-symbols',
      '---',
      'Some opaque body content',
      'Second line',
    ].join('\n'))
  })

  it('serializes a minimal NodeBlockData', () => {
    const data: NodeBlockData = {
      id: 'minimal',
      state: 'success',
      body: 'just body',
    }

    const serialized = nodeBlockDefinition.serialize!(data)

    expect(serialized).toBe([
      'id: minimal',
      'state: success',
      '---',
      'just body',
    ].join('\n'))
  })

  it('omits undefined optional fields', () => {
    const data: NodeBlockData = {
      id: 'no-optionals',
      state: 'failed',
      layer: undefined,
      subsystem: undefined,
      maps: undefined,
      body: '',
    }

    const serialized = nodeBlockDefinition.serialize!(data)

    expect(serialized).not.toContain('layer:')
    expect(serialized).not.toContain('subsystem:')
    expect(serialized).not.toContain('maps:')
    expect(serialized).toContain('id: no-optionals')
    expect(serialized).toContain('state: failed')
  })
})

describe('nodeMapBlockDefinition.serialize', () => {
  it('serializes NodeMapBlockData', () => {
    const data: NodeMapBlockData = {
      id: 'my-map',
      body: 'SYM1 = "value1"\nSYM2 = "value2"',
    }

    const serialized = nodeMapBlockDefinition.serialize!(data)
    expect(serialized).toBe('id: my-map\n---\nSYM1 = "value1"\nSYM2 = "value2"')
  })
})

// ---------------------------------------------------------------------------
// Round-trip: parse -> serialize -> parse
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('round-trips a node block with all fields', () => {
    const original = [
      'id: auth-login',
      'state: active',
      'layer: street',
      'subsystem: auth',
      'maps: auth-symbols',
      '---',
      'line one',
      'line two',
    ].join('\n')

    const firstParse = validateBlockYaml('node', original)
    expect(firstParse.errors).toHaveLength(0)
    const data1 = firstParse.data as NodeBlockData

    const serialized = nodeBlockDefinition.serialize!(data1)
    const secondParse = validateBlockYaml('node', serialized)
    expect(secondParse.errors).toHaveLength(0)
    const data2 = secondParse.data as NodeBlockData

    expect(data2).toEqual(data1)
  })

  it('round-trips a minimal node block', () => {
    const original = [
      'id: simple',
      'state: success',
      '---',
      'body text',
    ].join('\n')

    const firstParse = validateBlockYaml('node', original)
    const data1 = firstParse.data as NodeBlockData
    const serialized = nodeBlockDefinition.serialize!(data1)
    const secondParse = validateBlockYaml('node', serialized)
    const data2 = secondParse.data as NodeBlockData

    expect(data2).toEqual(data1)
  })

  it('round-trips body containing --- delimiters', () => {
    const original = [
      'id: tricky',
      'state: active',
      '---',
      'content before',
      '---',
      'content after',
    ].join('\n')

    const firstParse = validateBlockYaml('node', original)
    const data1 = firstParse.data as NodeBlockData
    expect(data1.body).toBe('content before\n---\ncontent after')

    const serialized = nodeBlockDefinition.serialize!(data1)
    const secondParse = validateBlockYaml('node', serialized)
    const data2 = secondParse.data as NodeBlockData

    expect(data2).toEqual(data1)
  })

  it('round-trips a node-map block', () => {
    const original = [
      'id: symbols',
      '---',
      'SYM = "value"',
    ].join('\n')

    const firstParse = validateBlockYaml('node-map', original)
    const data1 = firstParse.data as NodeMapBlockData
    const serialized = nodeMapBlockDefinition.serialize!(data1)
    const secondParse = validateBlockYaml('node-map', serialized)
    const data2 = secondParse.data as NodeMapBlockData

    expect(data2).toEqual(data1)
  })
})

// ---------------------------------------------------------------------------
// Integration with parseMarkdownBlocks
// ---------------------------------------------------------------------------

describe('parseMarkdownBlocks integration', () => {
  it('extracts node blocks from markdown', () => {
    const md = [
      '# Test Document',
      '',
      'Some text here.',
      '',
      '~~~node',
      'id: auth-login',
      'state: active',
      'layer: street',
      '---',
      'opaque body content',
      '~~~',
      '',
      'More text.',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'test.md')
    expect(result.errors).toHaveLength(0)
    expect(result.blocks).toHaveLength(1)

    const block = result.blocks[0]
    expect(block.type).toBe('node')
    expect(block.data).not.toBeNull()

    const data = block.data as NodeBlockData
    expect(data.id).toBe('auth-login')
    expect(data.state).toBe('active')
    expect(data.layer).toBe('street')
    expect(data.body).toBe('opaque body content')
  })

  it('extracts node-map blocks from markdown', () => {
    const md = [
      '# Maps',
      '',
      '~~~node-map',
      'id: auth-symbols',
      '---',
      'LOGIN = "login flow"',
      '~~~',
      '',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'maps.md')
    expect(result.errors).toHaveLength(0)
    expect(result.blocks).toHaveLength(1)

    const block = result.blocks[0]
    expect(block.type).toBe('node-map')

    const data = block.data as NodeMapBlockData
    expect(data.id).toBe('auth-symbols')
    expect(data.body).toBe('LOGIN = "login flow"')
  })

  it('extracts multiple node blocks from one document', () => {
    const md = [
      '~~~node',
      'id: node-a',
      'state: active',
      '---',
      'body a',
      '~~~',
      '',
      '~~~node',
      'id: node-b',
      'state: success',
      '---',
      'body b',
      '~~~',
      '',
      '~~~node-map',
      'id: my-map',
      '---',
      'symbols here',
      '~~~',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'multi.md')
    expect(result.errors).toHaveLength(0)
    expect(result.blocks).toHaveLength(3)
    expect(result.blocks[0].type).toBe('node')
    expect(result.blocks[1].type).toBe('node')
    expect(result.blocks[2].type).toBe('node-map')

    expect((result.blocks[0].data as NodeBlockData).id).toBe('node-a')
    expect((result.blocks[1].data as NodeBlockData).id).toBe('node-b')
    expect((result.blocks[2].data as NodeMapBlockData).id).toBe('my-map')
  })

  it('reports errors for invalid node blocks in markdown', () => {
    const md = [
      '~~~node',
      'state: active',
      '---',
      'no id!',
      '~~~',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'bad.md')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].data).toBeNull()
    expect(result.blocks[0].errors).toBeDefined()
    expect(result.blocks[0].errors!.length).toBeGreaterThan(0)
  })

  it('preserves source information for node blocks', () => {
    const md = [
      '# Header',
      '',
      '~~~node',
      'id: sourced',
      'state: active',
      '---',
      'body',
      '~~~',
    ].join('\n')

    const result = parseMarkdownBlocks(md, 'sourced.md')
    expect(result.blocks).toHaveLength(1)

    const source = result.blocks[0].source
    expect(source.filePath).toBe('sourced.md')
    expect(source.range.startLine).toBeGreaterThan(0)
    expect(source.range.endLine).toBeGreaterThan(0)
    expect(source.raw).toContain('~~~node')
    expect(source.raw).toContain('id: sourced')
  })
})

// ---------------------------------------------------------------------------
// Registry integration
// ---------------------------------------------------------------------------

describe('registry integration', () => {
  it('registers node as a known block type', () => {
    expect(blockRegistry.has('node')).toBe(true)
  })

  it('registers node-map as a known block type', () => {
    expect(blockRegistry.has('node-map')).toBe(true)
  })

  it('node definition has components', () => {
    const def = blockRegistry.get('node')
    expect(def).toBeDefined()
    expect(def!.components).toBeDefined()
    expect(def!.components!.inline).toBeDefined()
    expect(def!.components!.card).toBeDefined()
  })

  it('node-map definition exists but has no render components', () => {
    const def = blockRegistry.get('node-map')
    expect(def).toBeDefined()
    // node-map is data-only, no visual component
  })
})
