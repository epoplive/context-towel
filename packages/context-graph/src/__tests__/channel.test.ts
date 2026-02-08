import { describe, expect, it } from 'vitest'

import { createDirectChannel } from '../channel'

describe('channel (direct adapter)', () => {
  it('routes host->graph inbound messages', () => {
    const { hostSide, graphSide } = createDirectChannel()
    const received: any[] = []
    const unsub = graphSide.onMessage((msg) => received.push(msg))

    hostSide.send({ type: 'tree:update', items: [] })
    hostSide.send({ type: 'focus:set', path: '/tmp/readme.md', line: 3 })

    expect(received).toEqual([
      { type: 'tree:update', items: [] },
      { type: 'focus:set', path: '/tmp/readme.md', line: 3 },
    ])

    unsub()
    hostSide.send({ type: 'roots:set', roots: [] })
    expect(received.length).toBe(2)
  })

  it('routes graph->host outbound messages', () => {
    const { hostSide, graphSide } = createDirectChannel()
    const received: any[] = []
    const unsub = hostSide.onMessage((msg) => received.push(msg))

    graphSide.send({ type: 'file:open', path: '/tmp/readme.md', line: 10 })
    graphSide.send({ type: 'context:update', snapshot: { openPanels: [], tasks: [], documentStructure: [], links: [] } })

    expect(received[0]).toEqual({ type: 'file:open', path: '/tmp/readme.md', line: 10 })
    expect(received[1]?.type).toBe('context:update')

    unsub()
    graphSide.send({ type: 'file:preview', path: '/tmp/other.md' })
    expect(received.length).toBe(2)
  })
})

