import { describe, expect, it } from 'vitest'
import { parseWidgetMarkup } from './parser'

describe('widget markup parser', () => {
  it('parses nested widget tags into a tree', () => {
    const input = `<Grid columns="2">
      <Card title="First"><Text>Hello</Text></Card>
      <Card title="Second">World</Card>
    </Grid>`

    const nodes = parseWidgetMarkup(input, { enforceNesting: true })
    expect(nodes).toHaveLength(1)
    const grid = nodes[0]
    expect(grid.type).toBe('grid')
    expect(grid.children?.length).toBe(2)
    expect(grid.children?.[0].type).toBe('card')
    expect(grid.children?.[0].children?.[0].type).toBe('text')
  })

  it('rejects unsupported tags', () => {
    expect(() => parseWidgetMarkup('<Foo />')).toThrow('Unsupported widget tag')
  })

  it('rejects invalid nesting', () => {
    const input = `<Text><Card title="Bad"></Card></Text>`
    expect(() => parseWidgetMarkup(input, { enforceNesting: true })).toThrow('Invalid widget nesting')
  })
})
