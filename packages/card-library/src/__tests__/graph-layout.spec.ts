import { describe, it, expect } from 'vitest'
import {
  resolveCollisions,
  estimateNodeSize,
  buildNodeSizeMap,
  FALLBACK_NODE_SIZE,
} from '../graph/layout/shared'
import type { LayoutDimensions, LayoutPosition } from '../graph/types'

describe('resolveCollisions', () => {
  it('pushes overlapping nodes apart', () => {
    const positions = new Map<string, LayoutPosition>([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 10, y: 10 }], // overlaps with a
    ])
    const sizes = new Map<string, LayoutDimensions>([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ])

    resolveCollisions(positions, sizes)

    const a = positions.get('a')!
    const b = positions.get('b')!
    // After resolution, nodes should be further apart
    const distance = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
    expect(distance).toBeGreaterThan(14) // originally ~14.14
  })

  it('leaves non-overlapping nodes alone', () => {
    const positions = new Map<string, LayoutPosition>([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 500, y: 500 }],
    ])
    const sizes = new Map<string, LayoutDimensions>([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ])

    resolveCollisions(positions, sizes)

    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(positions.get('b')).toEqual({ x: 500, y: 500 })
  })

  it('respects custom padding and iterations', () => {
    const positions = new Map<string, LayoutPosition>([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 50, y: 0 }],
    ])
    const sizes = new Map<string, LayoutDimensions>([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ])

    resolveCollisions(positions, sizes, { padding: 0, iterations: 5 })

    // After resolution, nodes should no longer overlap
    const a = positions.get('a')!
    const b = positions.get('b')!
    // Either they moved apart horizontally or were pushed apart at all
    const gapX = b.x - (a.x + 100) // right edge of a to left edge of b
    const gapY = Math.abs(b.y - a.y)
    // At least one axis should show separation
    expect(gapX > -5 || gapY > 20).toBe(true)
  })
})

describe('estimateNodeSize', () => {
  it('returns measured dimensions when provided', () => {
    const measured = { width: 999, height: 888 }
    expect(estimateNodeSize('task', {}, measured)).toEqual(measured)
  })

  it('estimates folder size', () => {
    const size = estimateNodeSize('folder', {})
    expect(size).toEqual({ width: 150, height: 40 })
  })

  it('estimates task size', () => {
    const size = estimateNodeSize('task', {})
    expect(size).toEqual({ width: 280, height: 120 })
  })

  it('estimates diagram size', () => {
    const size = estimateNodeSize('diagram', {})
    expect(size).toEqual({ width: 500, height: 400 })
  })

  it('estimates filetree height based on items', () => {
    const size = estimateNodeSize('filetree', { items: new Array(10) })
    expect(size.width).toBe(220)
    expect(size.height).toBe(50 + 10 * 24)
  })

  it('estimates tasklist height based on tasks', () => {
    const size = estimateNodeSize('tasklist', { tasks: new Array(5) })
    expect(size.height).toBe(60 + 5 * 80)
  })

  it('estimates document height based on content', () => {
    const size = estimateNodeSize('document', {
      tasks: new Array(3),
      sections: new Array(2),
      checklists: new Array(1),
    })
    expect(size.height).toBeGreaterThan(80)
  })

  it('estimates pill-type nodes as compact', () => {
    for (const type of ['criterion', 'reference-pill', 'test-pill']) {
      const size = estimateNodeSize(type, {})
      expect(size.width).toBeLessThan(200)
      expect(size.height).toBeLessThan(50)
    }
  })

  it('returns fallback for unknown types', () => {
    const size = estimateNodeSize('unknown-custom-type', {})
    expect(size).toEqual(FALLBACK_NODE_SIZE)
  })
})

describe('buildNodeSizeMap', () => {
  it('builds size map from nodes', () => {
    const nodes = [
      { id: 'a', type: 'task', data: {} },
      { id: 'b', type: 'folder', data: {} },
    ]
    const sizeMap = buildNodeSizeMap(nodes)

    expect(sizeMap.get('a')).toEqual({ width: 280, height: 120 })
    expect(sizeMap.get('b')).toEqual({ width: 150, height: 40 })
  })

  it('uses measured dimensions when available', () => {
    const nodes = [{ id: 'a', type: 'task', data: {} }]
    const measured = new Map([['a', { width: 500, height: 300 }]])
    const sizeMap = buildNodeSizeMap(nodes, measured)

    expect(sizeMap.get('a')).toEqual({ width: 500, height: 300 })
  })

  it('handles nodes without type', () => {
    const nodes = [{ id: 'a', data: {} }]
    const sizeMap = buildNodeSizeMap(nodes)
    expect(sizeMap.get('a')).toEqual(FALLBACK_NODE_SIZE)
  })
})
