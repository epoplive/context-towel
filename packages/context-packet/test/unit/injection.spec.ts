import { describe, it, expect } from 'vitest'
import {
  extractProblemVector,
  formatProblemVectorSummary,
  injectPacketIntoContent,
  removePacketSection,
  PACKET_SECTION_START,
  PACKET_SECTION_END,
} from '../../src/injection'

describe('extractProblemVector', () => {
  it('extracts current, target, and approach', () => {
    const content = `# Packet: Auth

## Problem Vector
**Current:** No authentication. All endpoints public.
**Target:** JWT-based auth with RBAC.
**Approach:** Repository pattern + middleware chain.

## Architecture
`
    const vector = extractProblemVector(content)

    expect(vector).toEqual({
      current: 'No authentication. All endpoints public.',
      target: 'JWT-based auth with RBAC.',
      approach: 'Repository pattern + middleware chain.',
    })
  })

  it('returns null when section has only placeholders', () => {
    const content = `# Packet: Empty

## Problem Vector
**Current:** <!-- describe current broken/missing state -->
**Target:** <!-- describe desired working state -->
**Approach:** <!-- high-level strategy -->

## Architecture
`
    expect(extractProblemVector(content)).toBeNull()
  })

  it('returns null when no Problem Vector section', () => {
    const content = `# Packet: No Vector

## Architecture
Some content here.
`
    expect(extractProblemVector(content)).toBeNull()
  })

  it('handles partial vectors (some fields filled)', () => {
    const content = `# Packet: Partial

## Problem Vector
**Current:** Something is broken.
**Target:** <!-- fill this -->
**Approach:** Fix it.

## Architecture
`
    const vector = extractProblemVector(content)

    expect(vector).not.toBeNull()
    expect(vector!.current).toBe('Something is broken.')
    expect(vector!.approach).toBe('Fix it.')
  })
})

describe('formatProblemVectorSummary', () => {
  it('formats a compact summary', () => {
    const summary = formatProblemVectorSummary(
      'Auth System',
      {
        current: 'No auth',
        target: 'JWT + RBAC',
        approach: 'Repository pattern',
      },
      '.context/packets/auth-system.md',
    )

    expect(summary).toContain('## Active Packet: Auth System')
    expect(summary).toContain('**Problem:** No auth → JWT + RBAC')
    expect(summary).toContain('**Approach:** Repository pattern')
    expect(summary).toContain('**Packet:** `.context/packets/auth-system.md`')
    expect(summary).toContain('Read the packet file for full context')
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
