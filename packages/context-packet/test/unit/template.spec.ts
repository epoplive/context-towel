import { describe, it, expect } from 'vitest'
import { generatePacketMarkdown } from '../../src/template'
import type { ProblemVectorState, NodeContent } from '../../src/template'
import type { DeltaEntry } from '../../src/types'

describe('generatePacketMarkdown', () => {
  it('generates a packet with all sections', () => {
    const result = generatePacketMarkdown('Auth System')

    expect(result).toContain('# Packet: Auth System')
    expect(result).toContain('## Whiteboard')
    expect(result).toContain('## Problem Vectors')
    expect(result).toContain('## AICCL')
    expect(result).toContain('## Delta Log')
    expect(result).toContain('## Linked')
  })

  it('uses placeholder comments when no options provided', () => {
    const result = generatePacketMarkdown('Empty Packet')

    expect(result).toContain('<!-- Add mermaid diagrams here -->')
    expect(result).toContain('<!-- No active problem vectors -->')
    expect(result).toContain('<!-- No AICCL nodes -->')
    expect(result).toContain('<!-- No deltas recorded -->')
    expect(result).toContain('<!-- No linked files -->')
  })

  it('renders whiteboard sections with mermaid', () => {
    const whiteboard = new Map<string, string>()
    whiteboard.set('Architecture', 'graph TD\n  A --> B')
    whiteboard.set('Data Model', 'erDiagram\n  User ||--o{ Order : places')

    const result = generatePacketMarkdown('Test', { whiteboard })

    expect(result).toContain('### Architecture')
    expect(result).toContain('```mermaid')
    expect(result).toContain('graph TD')
    expect(result).toContain('### Data Model')
    expect(result).toContain('erDiagram')
  })

  it('renders problem vectors with state', () => {
    const problemVectors: ProblemVectorState[] = [
      {
        id: 'perf',
        current: 'Page loads in 5s',
        target: 'Page loads in <1s',
        approach: 'CDN + lazy loading',
        state: 'active',
      },
      {
        id: 'auth',
        current: 'No auth',
        target: 'JWT + RBAC',
        approach: 'Middleware chain',
        state: 'success',
      },
    ]

    const result = generatePacketMarkdown('Test', { problemVectors })

    expect(result).toContain('### perf [active]')
    expect(result).toContain('- **Current:** Page loads in 5s')
    expect(result).toContain('- **Target:** Page loads in <1s')
    expect(result).toContain('### auth [success]')
  })

  it('renders AICCL nodes as ~~~node blocks', () => {
    const nodes: NodeContent[] = [
      {
        id: 'auth-middleware',
        state: 'active',
        layer: 'district',
        body: 'Implementing JWT validation\nwith refresh tokens',
      },
      {
        id: 'db-schema',
        state: 'success',
        subsystem: 'database',
        body: 'Schema migration complete',
      },
    ]

    const result = generatePacketMarkdown('Test', { nodes })

    expect(result).toContain('~~~node')
    expect(result).toContain('id: auth-middleware')
    expect(result).toContain('state: active')
    expect(result).toContain('layer: district')
    expect(result).toContain('body: |')
    expect(result).toContain('  Implementing JWT validation')
    expect(result).toContain('id: db-schema')
    expect(result).toContain('subsystem: database')
  })

  it('renders delta log entries most recent first', () => {
    const deltas: DeltaEntry[] = [
      {
        id: 'delta-1',
        packetName: 'test',
        timestamp: 1000000,
        nodeId: 'node-1',
        type: 'discovery',
        content: 'First event',
      },
      {
        id: 'delta-2',
        packetName: 'test',
        timestamp: 2000000,
        nodeId: 'node-1',
        type: 'success',
        content: 'Second event',
      },
    ]

    const result = generatePacketMarkdown('Test', { deltas })

    // Second event should appear before first event (most recent first)
    const secondIdx = result.indexOf('Second event')
    const firstIdx = result.indexOf('First event')
    expect(secondIdx).toBeLessThan(firstIdx)
    expect(result).toContain('**discovery**')
    expect(result).toContain('**success**')
    expect(result).toContain('[node-1]')
  })

  it('renders linked plan file reference', () => {
    const result = generatePacketMarkdown('Test', {
      linked: { planFileRef: '.context/working/plan.md' },
    })

    expect(result).toContain('Plan: `.context/working/plan.md`')
  })
})
