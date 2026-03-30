import { describe, it, expect } from 'vitest'
import { buildContextOutput } from '../../src/cli/context'

// Minimal packet markdown for testing
const SAMPLE_PACKET = `# Packet: test-packet

## Whiteboard

### architecture

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

## Problem Vectors

### primary [active]
- **Current:** Investigating auth flow
- **Target:** Working SSO integration
- **Approach:** Trace token lifecycle

## Nodes

~~~node
id: investigate-auth
state: active
---
Looking into how tokens are passed between services.
Found that session middleware strips the auth header.
~~~

~~~node
id: fix-middleware
state: success
---
Patched the middleware to forward auth headers.
~~~

## Delta Log

- \`2026-03-23 10:00:00\` **discovery** [investigate-auth]: Found session middleware strips auth header
- \`2026-03-23 11:00:00\` **success** [fix-middleware]: Patched middleware to forward headers
- \`2026-03-23 12:00:00\` **mutation** [investigate-auth]: Updated investigation notes

## Linked

- Plan: \`.context/working/plan.md\`
`

const mockReader = async (path: string): Promise<string> => {
  if (path.includes('test-packet.md')) return SAMPLE_PACKET
  throw new Error(`File not found: ${path}`)
}

describe('buildContextOutput', () => {
  it('produces full compact XML with all sections', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader)
    expect(result).not.toBeNull()
    expect(result!).toContain('<context-packet name="test-packet"')
    expect(result!).toContain('<vectors>')
    expect(result!).toContain('<nodes>')
    expect(result!).toContain('<instructions>')
    expect(result!).toContain('primary [active]')
    expect(result!).toContain('investigate-auth')
  })

  it('includes vector current/target in output', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader)
    expect(result).not.toBeNull()
    expect(result!).toContain('Investigating auth flow')
    expect(result!).toContain('Working SSO integration')
  })

  it('condenses resolved nodes into resolved: line', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader)
    expect(result).not.toBeNull()
    expect(result!).toContain('resolved: fix-middleware')
  })

  it('includes active nodes with body summary', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader)
    expect(result).not.toBeNull()
    expect(result!).toContain('investigate-auth [active]')
    expect(result!).toContain('Looking into how tokens')
  })

  it('includes recent deltas', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader)
    expect(result).not.toBeNull()
    expect(result!).toContain('<recent count="3">')
    expect(result!).toContain('[discovery] investigate-auth:')
    expect(result!).toContain('[success] fix-middleware:')
    expect(result!).toContain('[mutation] investigate-auth:')
  })

  it('includes whiteboard section names', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader)
    expect(result).not.toBeNull()
    expect(result!).toContain('<whiteboard>')
    expect(result!).toContain('architecture')
    expect(result!).toContain('(1 diagram)')
  })

  it('returns null for missing packet', async () => {
    const result = await buildContextOutput('.context', 'nonexistent', mockReader)
    expect(result).toBeNull()
  })

  it('produces focused node output when focusNodes specified', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader, {
      focusNodes: ['investigate-auth'],
    })
    expect(result).not.toBeNull()
    expect(result!).toContain('investigate-auth [active]')
    // Focused nodes get more body text
    expect(result!).toContain('Looking into how tokens are passed')
  })
})
