import { describe, it, expect } from 'vitest'
import {
  generateCanarySymbol,
  buildCanarySection,
  buildCanaryOverride,
  parseCanaryOverrides,
  createDefaultCanaryState,
  applyOverrides,
  verifyCanary,
} from '../canary'

describe('generateCanarySymbol', () => {
  it('generates deterministic symbols', () => {
    const s1 = generateCanarySymbol('index', '/my/project/index')
    const s2 = generateCanarySymbol('index', '/my/project/index')
    expect(s1).toBe(s2)
  })

  it('different seeds produce different symbols', () => {
    const s1 = generateCanarySymbol('index', '/project-a/index')
    const s2 = generateCanarySymbol('index', '/project-b/index')
    expect(s1).not.toBe(s2)
  })

  it('includes contract name prefix', () => {
    const s = generateCanarySymbol('packet', 'seed')
    expect(s.startsWith('packet:')).toBe(true)
  })
})

describe('buildCanarySection', () => {
  it('generates markdown with all contracts', () => {
    const state = createDefaultCanaryState('/test/project')
    const section = buildCanarySection(state)

    expect(section).toContain('## Verification Symbols')
    expect(section).toContain('**index:**')
    expect(section).toContain('**packet:**')
    expect(section).toContain('**docs:**')
  })

  it('shows overridden symbols when active', () => {
    const state = createDefaultCanaryState('/test/project')
    state.contracts[0].overrideSymbol = 'index:override1'
    const section = buildCanarySection(state)

    expect(section).toContain('`index:override1`')
  })

  it('returns empty string for no contracts', () => {
    const section = buildCanarySection({ contracts: [], generatedAt: '' })
    expect(section).toBe('')
  })
})

describe('buildCanaryOverride / parseCanaryOverrides', () => {
  it('round-trips override format', () => {
    const override = buildCanaryOverride('index', 'index:abc123')
    expect(override).toBe('<!-- canary:index=index:abc123 -->')

    const parsed = parseCanaryOverrides(override)
    expect(parsed.get('index')).toBe('index:abc123')
  })

  it('parses multiple overrides', () => {
    const content = `Some text
<!-- canary:index=index:aaa -->
More text
<!-- canary:packet=packet:bbb -->
End`

    const parsed = parseCanaryOverrides(content)
    expect(parsed.size).toBe(2)
    expect(parsed.get('index')).toBe('index:aaa')
    expect(parsed.get('packet')).toBe('packet:bbb')
  })

  it('returns empty map for no overrides', () => {
    const parsed = parseCanaryOverrides('no overrides here')
    expect(parsed.size).toBe(0)
  })
})

describe('createDefaultCanaryState', () => {
  it('creates three default contracts', () => {
    const state = createDefaultCanaryState('/my/project')
    expect(state.contracts).toHaveLength(3)
    expect(state.contracts.map(c => c.name)).toEqual(['index', 'packet', 'docs'])
  })

  it('all contracts start with no overrides', () => {
    const state = createDefaultCanaryState('/my/project')
    for (const c of state.contracts) {
      expect(c.overrideSymbol).toBeNull()
      expect(c.overrideSource).toBeNull()
    }
  })
})

describe('applyOverrides', () => {
  it('applies overrides from sub-files', () => {
    const state = createDefaultCanaryState('/project')
    const updated = applyOverrides(state, [
      {
        source: '.context/docs/arch.md',
        overrides: new Map([['docs', 'docs:overridden']]),
      },
    ])

    const docsContract = updated.contracts.find(c => c.name === 'docs')!
    expect(docsContract.overrideSymbol).toBe('docs:overridden')
    expect(docsContract.overrideSource).toBe('.context/docs/arch.md')
  })

  it('last override wins', () => {
    const state = createDefaultCanaryState('/project')
    const updated = applyOverrides(state, [
      {
        source: 'file-a.md',
        overrides: new Map([['index', 'index:aaa']]),
      },
      {
        source: 'file-b.md',
        overrides: new Map([['index', 'index:bbb']]),
      },
    ])

    const indexContract = updated.contracts.find(c => c.name === 'index')!
    expect(indexContract.overrideSymbol).toBe('index:bbb')
    expect(indexContract.overrideSource).toBe('file-b.md')
  })

  it('does not mutate original state', () => {
    const state = createDefaultCanaryState('/project')
    applyOverrides(state, [
      {
        source: 'file.md',
        overrides: new Map([['index', 'index:new']]),
      },
    ])

    expect(state.contracts[0].overrideSymbol).toBeNull()
  })
})

describe('verifyCanary', () => {
  it('passes when echoed symbols match base', () => {
    const state = createDefaultCanaryState('/project')
    const echoed = new Map<string, string>()
    for (const c of state.contracts) {
      echoed.set(c.name, c.baseSymbol)
    }

    const results = verifyCanary(state, echoed)
    expect(results.every(r => r.status === 'pass')).toBe(true)
  })

  it('passes when echoed symbols match overrides', () => {
    const state = createDefaultCanaryState('/project')
    state.contracts[0].overrideSymbol = 'index:override'

    const echoed = new Map([
      ['index', 'index:override'],
      ['packet', state.contracts[1].baseSymbol],
      ['docs', state.contracts[2].baseSymbol],
    ])

    const results = verifyCanary(state, echoed)
    expect(results.every(r => r.status === 'pass')).toBe(true)
  })

  it('fails when echoed symbols are wrong', () => {
    const state = createDefaultCanaryState('/project')
    const echoed = new Map([
      ['index', 'index:wrong'],
      ['packet', state.contracts[1].baseSymbol],
      ['docs', state.contracts[2].baseSymbol],
    ])

    const results = verifyCanary(state, echoed)
    const indexResult = results.find(r => r.contract === 'index')!
    expect(indexResult.status).toBe('fail')
    expect(indexResult.got).toBe('index:wrong')
  })

  it('reports missing when contract not echoed', () => {
    const state = createDefaultCanaryState('/project')
    const echoed = new Map<string, string>()

    const results = verifyCanary(state, echoed)
    expect(results.every(r => r.status === 'missing')).toBe(true)
  })
})
