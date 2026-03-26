import { describe, it, expect } from 'vitest'
import { parsePacketSections, parseProblemVectors, parseDeltaLog } from './parsePacketContent'

describe('parsePacketSections', () => {
  it('splits markdown into sections by ## headers', () => {
    const md = `# Title
Some preamble

## Whiteboard
Mermaid content here

## AICCL
Node blocks here

## Delta Log
- [2026-01-01] (log) something happened
`
    const sections = parsePacketSections(md)
    expect(sections).toHaveLength(3)
    expect(sections[0].name).toBe('Whiteboard')
    expect(sections[0].content).toContain('Mermaid content here')
    expect(sections[1].name).toBe('AICCL')
    expect(sections[2].name).toBe('Delta Log')
  })

  it('returns empty array for markdown without h2 headers', () => {
    const sections = parsePacketSections('# Just a title\nSome body text')
    expect(sections).toHaveLength(0)
  })

  it('tracks correct startLine for sections', () => {
    const md = `line0
## First
content
## Second
more content`
    const sections = parsePacketSections(md)
    expect(sections[0].startLine).toBe(2) // line index 1, +1
    expect(sections[1].startLine).toBe(4)
  })
})

describe('parseProblemVectors', () => {
  it('parses new-format vectors with ### headers', () => {
    const sections = parsePacketSections(`## Problem Vectors

### auth-flow [open]
**Current:** No auth
**Target:** JWT auth
**Approach:** Use passport.js

### data-sync [resolved]
**Current:** Manual sync
**Target:** Auto sync
**Approach:** WebSocket events
`)
    const vectors = parseProblemVectors(sections)
    expect(vectors).toHaveLength(2)
    expect(vectors[0].id).toBe('auth-flow')
    expect(vectors[0].state).toBe('open')
    expect(vectors[0].current).toBe('No auth')
    expect(vectors[0].target).toBe('JWT auth')
    expect(vectors[0].approach).toBe('Use passport.js')
    expect(vectors[1].id).toBe('data-sync')
    expect(vectors[1].state).toBe('resolved')
  })

  it('falls back to old-style single Problem Vector section', () => {
    const sections = parsePacketSections(`## Problem Vector
**Current:** Broken
**Target:** Fixed
**Approach:** Debug it
`)
    const vectors = parseProblemVectors(sections)
    expect(vectors).toHaveLength(1)
    expect(vectors[0].id).toBe('default')
    expect(vectors[0].state).toBe('open')
    expect(vectors[0].current).toBe('Broken')
  })

  it('returns empty array when no vector section exists', () => {
    const sections = parsePacketSections(`## AICCL\nSome nodes\n`)
    expect(parseProblemVectors(sections)).toEqual([])
  })
})

describe('parseDeltaLog', () => {
  it('parses new-format delta log entries', () => {
    const sections = parsePacketSections(`## Delta Log
- [2026-01-01T10:00] (mutation) [node-1] Updated auth config
- [2026-01-01T10:05] (observation) Tests passing
`)
    const entries = parseDeltaLog(sections)
    expect(entries).toHaveLength(2)
    expect(entries[0].timestamp).toBe('2026-01-01T10:00')
    expect(entries[0].type).toBe('mutation')
    expect(entries[0].nodeId).toBe('node-1')
    expect(entries[0].content).toBe('Updated auth config')
    expect(entries[1].type).toBe('observation')
    expect(entries[1].nodeId).toBeUndefined()
    expect(entries[1].content).toBe('Tests passing')
  })

  it('falls back to old Session Log format', () => {
    const sections = parsePacketSections(`## Session Log
- [2026-01-01] Did something
- [2026-01-02] Did something else
`)
    const entries = parseDeltaLog(sections)
    expect(entries).toHaveLength(2)
    expect(entries[0].type).toBe('log')
    expect(entries[0].content).toBe('Did something')
  })

  it('returns empty array when no log section exists', () => {
    const sections = parsePacketSections(`## AICCL\nSome nodes\n`)
    expect(parseDeltaLog(sections)).toEqual([])
  })

  it('parses materialized delta log with **type** format', () => {
    const sections = parsePacketSections(`## Delta Log

- \`2026-03-25 14:30:00\` **discovery** [auth-work]: Found tokens expire after 15 min
- \`2026-03-25 15:00:00\` **success** [fix-endpoint]: Implemented refresh endpoint
- \`2026-03-25 15:30:00\` **mutation** [auth-work]: Updated investigation
`)
    const entries = parseDeltaLog(sections)
    expect(entries.length).toBeGreaterThanOrEqual(3)
  })
})
