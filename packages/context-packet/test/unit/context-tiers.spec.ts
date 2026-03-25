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

## AICCL

~~~node
id: investigate-auth
state: active
confidence: 0.7
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

describe('buildContextOutput compression levels', () => {
  it('level 1 (default): full compact XML', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader)
    expect(result).not.toBeNull()
    expect(result!).toContain('<context-packet name="test-packet"')
    expect(result!).toContain('<vectors>')
    expect(result!).toContain('<nodes>')
    expect(result!).toContain('<instructions>')
    expect(result!).toContain('primary [active]')
    expect(result!).toContain('investigate-auth')
  })

  it('level 0: raw markdown', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader, { compressionLevel: 0 })
    expect(result).toBe(SAMPLE_PACKET)
  })

  it('level 2: metadata index', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader, { compressionLevel: 2 })
    expect(result).not.toBeNull()
    expect(result!).toContain('level="2"')
    expect(result!).toContain('<vectors count="1">')
    expect(result!).toContain('primary [active]')
    expect(result!).toContain('<nodes')
    expect(result!).toContain('investigate-auth [active] {0.7}')
    expect(result!).toContain('resolved: fix-middleware')
    expect(result!).toContain('<pull-commands>')
    // Should NOT have full instructions block
    expect(result!).not.toContain('<instructions>')
  })

  it('level 3: position summary', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader, { compressionLevel: 3 })
    expect(result).not.toBeNull()
    expect(result!).toContain('level="3"')
    expect(result!).toContain('primary [active]')
    expect(result!).toContain('Investigating auth flow')
    expect(result!).toContain('vectors: 1')
    expect(result!).toContain('nodes:')
    expect(result!).toContain('deltas:')
  })

  it('level 4: ultra-compact', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader, { compressionLevel: 4 })
    expect(result).not.toBeNull()
    expect(result!).toContain('level="4"')
    expect(result!).toContain('Investigating auth flow')
    // Should be very short
    expect(result!.length).toBeLessThan(200)
  })

  it('level 1 includes confidence in node output', async () => {
    const result = await buildContextOutput('.context', 'test-packet', mockReader, { compressionLevel: 1 })
    expect(result).not.toBeNull()
    // The active node has confidence: 0.7 — should appear in compact output
    expect(result!).toContain('{0.7}')
  })

  it('returns null for missing packet', async () => {
    const result = await buildContextOutput('.context', 'nonexistent', mockReader)
    expect(result).toBeNull()
  })
})
