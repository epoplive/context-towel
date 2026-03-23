import { describe, it, expect } from 'vitest'
import {
  parseCompMaps,
  parseCompBlocks,
  resolveSymbol,
  resolveAllSymbols,
  buildSymbolTable,
} from '../../src/aiccl/parseCompMaps'

describe('parseCompMaps', () => {
  it('parses a single comp map block', () => {
    const content = `
<comp:map:auth>
🔐=auth 🎫=jwt 👤=user
🏠=session 🔑=refresh
</comp:map:auth>
`
    const maps = parseCompMaps(content)
    expect(maps).toHaveLength(1)
    expect(maps[0].id).toBe('auth')
    expect(maps[0].parentId).toBeUndefined()
    expect(maps[0].symbols.size).toBe(5)
    expect(maps[0].symbols.get('🔐')).toBe('auth')
    expect(maps[0].symbols.get('🎫')).toBe('jwt')
    expect(maps[0].symbols.get('🏠')).toBe('session')
  })

  it('parses map with inheritance', () => {
    const content = `
<comp:map:base>
A=alpha B=beta
</comp:map:base>

<comp:map:child uses="base">
C=gamma D=delta
</comp:map:child>
`
    const maps = parseCompMaps(content)
    expect(maps).toHaveLength(2)
    expect(maps[0].id).toBe('base')
    expect(maps[1].id).toBe('child')
    expect(maps[1].parentId).toBe('base')
  })

  it('parses multiple maps', () => {
    const content = `
<comp:map:auth>🔐=auth</comp:map:auth>
<comp:map:net>📡=api</comp:map:net>
`
    const maps = parseCompMaps(content)
    expect(maps).toHaveLength(2)
    expect(maps[0].id).toBe('auth')
    expect(maps[1].id).toBe('net')
  })

  it('returns empty array for content without maps', () => {
    const maps = parseCompMaps('No maps here, just plain text.')
    expect(maps).toHaveLength(0)
  })

  it('handles inline symbol=expansion format', () => {
    const content = `<comp:map:short>A=1 B=2 C=3</comp:map:short>`
    const maps = parseCompMaps(content)
    expect(maps).toHaveLength(1)
    expect(maps[0].symbols.size).toBe(3)
    expect(maps[0].symbols.get('A')).toBe('1')
  })
})

describe('parseCompBlocks', () => {
  it('parses a container block', () => {
    const content = `
<comp:auth>
∀ req → validate(token) → session | ⊥
</comp:auth>
`
    const blocks = parseCompBlocks(content)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].id).toBe('auth')
    expect(blocks[0].content).toContain('∀ req → validate(token)')
  })

  it('parses container block with layer', () => {
    const content = `
<comp:auth:L2>
Token validation flow
</comp:auth>
`
    const blocks = parseCompBlocks(content)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].id).toBe('auth')
    expect(blocks[0].layer).toBe('L2')
  })

  it('does not capture map blocks as container blocks', () => {
    const content = `
<comp:map:auth>
🔐=auth
</comp:map:auth>

<comp:net>
Network stuff
</comp:net>
`
    const blocks = parseCompBlocks(content)
    // Should only capture the net block, not the map block
    expect(blocks.every(b => b.id !== 'map')).toBe(true)
    expect(blocks.some(b => b.id === 'net')).toBe(true)
  })
})

describe('resolveSymbol', () => {
  it('resolves a symbol from a single map', () => {
    const maps = parseCompMaps('<comp:map:auth>🔐=auth 🎫=jwt</comp:map:auth>')
    expect(resolveSymbol('🔐', maps)).toBe('auth')
    expect(resolveSymbol('🎫', maps)).toBe('jwt')
  })

  it('returns original symbol when not found', () => {
    const maps = parseCompMaps('<comp:map:auth>🔐=auth</comp:map:auth>')
    expect(resolveSymbol('🔥', maps)).toBe('🔥')
  })

  it('resolves through inheritance chain', () => {
    const content = `
<comp:map:base>A=alpha B=beta</comp:map:base>
<comp:map:child uses="base">C=gamma</comp:map:child>
`
    const maps = parseCompMaps(content)
    // C is in child directly
    expect(resolveSymbol('C', maps, 'child')).toBe('gamma')
    // A is inherited from base
    expect(resolveSymbol('A', maps, 'child')).toBe('alpha')
  })

  it('handles missing map gracefully', () => {
    const maps = parseCompMaps('<comp:map:auth>🔐=auth</comp:map:auth>')
    expect(resolveSymbol('🔐', maps, 'nonexistent')).toBe('auth')
  })
})

describe('resolveAllSymbols', () => {
  it('expands all symbols in text', () => {
    const maps = parseCompMaps('<comp:map:auth>🔐=auth 🎫=jwt</comp:map:auth>')
    const result = resolveAllSymbols('∀ req → 🔐(🎫)', maps)
    expect(result).toBe('∀ req → auth(jwt)')
  })

  it('leaves text unchanged when no symbols match', () => {
    const maps = parseCompMaps('<comp:map:auth>🔐=auth</comp:map:auth>')
    const result = resolveAllSymbols('plain text', maps)
    expect(result).toBe('plain text')
  })
})

describe('buildSymbolTable', () => {
  it('builds flat table from single map', () => {
    const maps = parseCompMaps('<comp:map:auth>🔐=auth 🎫=jwt</comp:map:auth>')
    const table = buildSymbolTable(maps)
    expect(table.size).toBe(2)
    expect(table.get('🔐')).toBe('auth')
  })

  it('merges inherited symbols', () => {
    const content = `
<comp:map:base>A=alpha B=beta</comp:map:base>
<comp:map:child uses="base">C=gamma</comp:map:child>
`
    const maps = parseCompMaps(content)
    const table = buildSymbolTable(maps)
    expect(table.get('A')).toBe('alpha')
    expect(table.get('B')).toBe('beta')
    expect(table.get('C')).toBe('gamma')
  })

  it('child symbols override parent', () => {
    const content = `
<comp:map:base>A=alpha B=beta</comp:map:base>
<comp:map:child uses="base">A=overridden</comp:map:child>
`
    const maps = parseCompMaps(content)
    const table = buildSymbolTable(maps)
    expect(table.get('A')).toBe('overridden')
  })

  it('handles cycle in inheritance without infinite loop', () => {
    // Cycles shouldn't happen in practice but parser should be resilient
    const maps = [
      { id: 'a', parentId: 'b', symbols: new Map([['X', '1']]) },
      { id: 'b', parentId: 'a', symbols: new Map([['Y', '2']]) },
    ]
    const table = buildSymbolTable(maps)
    // Should complete without hanging
    expect(table.size).toBeGreaterThan(0)
  })
})
