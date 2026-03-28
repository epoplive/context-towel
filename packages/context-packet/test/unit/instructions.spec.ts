import { describe, it, expect } from 'vitest'
import { PACKET_WORKFLOW_INSTRUCTIONS, generateWorkflowSection } from '../../src/instructions'

describe('PACKET_WORKFLOW_INSTRUCTIONS', () => {
  it('is a non-empty string', () => {
    expect(typeof PACKET_WORKFLOW_INSTRUCTIONS).toBe('string')
    expect(PACKET_WORKFLOW_INSTRUCTIONS.length).toBeGreaterThan(100)
  })

  it('contains the phase headers', () => {
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Phase 1: COMPILE')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Phase 2: VERIFY')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Phase 3: SOLVE LOGIC')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Phase 4: IMPLEMENT')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Phase 5: UPDATE')
  })

  it('contains CLI reference commands', () => {
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('packet node update')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('packet node promote')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('packet vector update')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('packet compile status')
  })

  it('contains rules section', () => {
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('NEVER edit packet markdown files directly')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Compile before solving')
  })

  it('contains comp map example', () => {
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('<comp:map:auth>')
  })

  it('contains failure annotations section', () => {
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Failure Annotations')
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('packet node fail')
  })

  it('contains entity reference guidance', () => {
    expect(PACKET_WORKFLOW_INSTRUCTIONS).toContain('Entity References in Packets')
  })
})

describe('generateWorkflowSection', () => {
  it('returns the workflow instructions', () => {
    const result = generateWorkflowSection()
    expect(result).toBe(PACKET_WORKFLOW_INSTRUCTIONS)
  })

  it('returns a string starting with ## header', () => {
    const result = generateWorkflowSection()
    expect(result).toMatch(/^## Packet Workflow/)
  })
})
