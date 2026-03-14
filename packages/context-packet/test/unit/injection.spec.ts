import { describe, it, expect } from 'vitest'
import {
  extractProblemVectors,
  formatInjectionContent,
  injectPacketIntoContent,
  removePacketSection,
  PACKET_SECTION_START,
  PACKET_SECTION_END,
} from '../../src/injection'
import type { ProblemVectorState } from '../../src/template'

describe('extractProblemVectors', () => {
  it('extracts vectors from the new format', () => {
    const content = `# Packet: Auth

## Problem Vectors

### perf [active]
- **Current:** Page loads in 5s
- **Target:** Page loads in <1s
- **Approach:** CDN + lazy loading

### auth [success]
- **Current:** No auth
- **Target:** JWT + RBAC
- **Approach:** Middleware chain

## AICCL
`
    const vectors = extractProblemVectors(content)

    expect(vectors).toHaveLength(2)
    expect(vectors[0]).toEqual({
      id: 'perf',
      current: 'Page loads in 5s',
      target: 'Page loads in <1s',
      approach: 'CDN + lazy loading',
      state: 'active',
    })
    expect(vectors[1]).toEqual({
      id: 'auth',
      current: 'No auth',
      target: 'JWT + RBAC',
      approach: 'Middleware chain',
      state: 'success',
    })
  })

  it('returns empty array when no Problem Vectors section', () => {
    const content = `# Packet: Empty

## AICCL
Some content.
`
    expect(extractProblemVectors(content)).toEqual([])
  })

  it('returns empty array when section has only placeholders', () => {
    const content = `# Packet: Empty

## Problem Vectors

<!-- No active problem vectors -->

## AICCL
`
    expect(extractProblemVectors(content)).toEqual([])
  })

  it('handles single vector', () => {
    const content = `# Packet: Single

## Problem Vectors

### main [active]
- **Current:** Broken
- **Target:** Fixed
- **Approach:** Fix it

## AICCL
`
    const vectors = extractProblemVectors(content)
    expect(vectors).toHaveLength(1)
    expect(vectors[0].id).toBe('main')
    expect(vectors[0].state).toBe('active')
  })

  it('handles failed state', () => {
    const content = `# Packet: Failed

## Problem Vectors

### attempt-1 [failed]
- **Current:** Slow
- **Target:** Fast
- **Approach:** Caching (did not work)

## AICCL
`
    const vectors = extractProblemVectors(content)
    expect(vectors).toHaveLength(1)
    expect(vectors[0].state).toBe('failed')
  })
})

describe('formatInjectionContent', () => {
  it('formats vectors for CLAUDE.md injection', () => {
    const vectors: ProblemVectorState[] = [
      {
        id: 'perf',
        current: 'Slow',
        target: 'Fast',
        approach: 'Caching',
        state: 'active',
      },
    ]

    const result = formatInjectionContent(
      'Auth System',
      vectors,
      '.context/packets/active/auth-system.md',
    )

    expect(result).toContain('## Active Packet: Auth System')
    expect(result).toContain('**Packet:** `.context/packets/active/auth-system.md`')
    expect(result).toContain('**perf** [active]')
    expect(result).toContain('Slow --> Fast')
    expect(result).toContain('Approach: Caching')
  })

  it('handles empty vectors', () => {
    const result = formatInjectionContent(
      'Test',
      [],
      '.context/packets/active/test.md',
    )

    expect(result).toContain('No active problem vectors')
  })

  it('shows state icons correctly', () => {
    const vectors: ProblemVectorState[] = [
      { id: 'a', current: 'X', target: 'Y', approach: 'Z', state: 'active' },
      { id: 'b', current: 'X', target: 'Y', approach: 'Z', state: 'success' },
      { id: 'c', current: 'X', target: 'Y', approach: 'Z', state: 'failed' },
    ]

    const result = formatInjectionContent('Test', vectors, 'path')

    expect(result).toContain('[active]')
    expect(result).toContain('[done]')
    expect(result).toContain('[failed]')
  })
})

describe('injectPacketIntoContent', () => {
  it('appends section when markers not found', () => {
    const content = '# CLAUDE.md\n\nSome existing content.'
    const result = injectPacketIntoContent(content, 'Packet summary here')

    expect(result).toContain('# CLAUDE.md')
    expect(result).toContain(PACKET_SECTION_START)
    expect(result).toContain('Packet summary here')
    expect(result).toContain(PACKET_SECTION_END)
  })

  it('replaces existing section', () => {
    const content = `# CLAUDE.md

${PACKET_SECTION_START}
Old packet content
${PACKET_SECTION_END}

Other stuff`

    const result = injectPacketIntoContent(content, 'New packet content')

    expect(result).toContain('New packet content')
    expect(result).not.toContain('Old packet content')
    expect(result).toContain('Other stuff')
  })
})

describe('removePacketSection', () => {
  it('removes the section and cleans whitespace', () => {
    const content = `# CLAUDE.md

${PACKET_SECTION_START}
Some packet content
${PACKET_SECTION_END}

Other stuff`

    const result = removePacketSection(content)

    expect(result).not.toContain(PACKET_SECTION_START)
    expect(result).not.toContain('Some packet content')
    expect(result).toContain('# CLAUDE.md')
    expect(result).toContain('Other stuff')
  })

  it('returns content unchanged when no markers', () => {
    const content = '# CLAUDE.md\n\nNo packet here.'
    expect(removePacketSection(content)).toBe(content)
  })
})
