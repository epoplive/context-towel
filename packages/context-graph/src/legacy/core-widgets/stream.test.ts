import { describe, expect, it } from 'vitest'
import { createWidgetStreamState, updateWidgetStream } from './stream'

describe('widget stream parser', () => {
  it('updates nodes when tags are complete', () => {
    const state = createWidgetStreamState()
    const next = updateWidgetStream(state, '<Card title="A">Hello</Card>')
    expect(next.nodes).toHaveLength(1)
    expect(next.nodes[0].type).toBe('card')
  })

  it('keeps previous nodes when stream is incomplete', () => {
    const state = createWidgetStreamState()
    const partial = updateWidgetStream(state, '<Card title="A">Hello')
    expect(partial.nodes).toEqual([])
    const complete = updateWidgetStream(partial, '</Card>')
    expect(complete.nodes).toHaveLength(1)
  })
})
