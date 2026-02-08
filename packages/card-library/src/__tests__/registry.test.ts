import { describe, expect, it, beforeEach } from 'vitest'
import { blockRegistry } from '../blocks/registry'
import { registerCoreBlocks } from '../blocks/core'
import { registerAllCardPlugins } from '../index'

describe('block registry', () => {
  beforeEach(() => {
    blockRegistry.clear()
  })

  it('starts empty', () => {
    expect(blockRegistry.list()).toHaveLength(0)
  })

  it('registers a block definition', () => {
    blockRegistry.register({ type: 'test', name: 'Test' })
    expect(blockRegistry.has('test')).toBe(true)
    expect(blockRegistry.get('test')?.name).toBe('Test')
  })

  it('throws on duplicate registration', () => {
    blockRegistry.register({ type: 'test', name: 'Test' })
    expect(() => blockRegistry.register({ type: 'test', name: 'Test 2' }))
      .toThrow('Block type already registered: test')
  })

  it('lists all registered definitions', () => {
    blockRegistry.register({ type: 'a', name: 'A' })
    blockRegistry.register({ type: 'b', name: 'B' })
    expect(blockRegistry.list()).toHaveLength(2)
  })

  it('clears all definitions', () => {
    blockRegistry.register({ type: 'test', name: 'Test' })
    blockRegistry.clear()
    expect(blockRegistry.has('test')).toBe(false)
    expect(blockRegistry.list()).toHaveLength(0)
  })
})

describe('registerAllCardPlugins', () => {
  beforeEach(() => {
    blockRegistry.clear()
  })

  it('upgrades core stubs to plugin definitions', () => {
    // Core blocks exist so parsing/validation can work even if plugins haven't loaded.
    // Plugin registration must be able to replace those "stub" entries with real
    // render components.
    registerCoreBlocks()
    registerAllCardPlugins()

    const task = blockRegistry.get('task')
    expect(task?.components).toBeDefined()
    expect(task?.components?.card || task?.components?.inline).toBeTruthy()
  })

  it('registers all core plugins', () => {
    registerAllCardPlugins()
    expect(blockRegistry.has('task')).toBe(true)
    expect(blockRegistry.has('checklist')).toBe(true)
    expect(blockRegistry.has('diagram')).toBe(true)
    expect(blockRegistry.has('toc')).toBe(true)
    expect(blockRegistry.has('note')).toBe(true)
    expect(blockRegistry.has('rule')).toBe(true)
    expect(blockRegistry.has('question')).toBe(true)
    expect(blockRegistry.has('form')).toBe(true)
  })

  it('is safe to call multiple times', () => {
    registerAllCardPlugins()
    const firstCount = blockRegistry.list().length
    registerAllCardPlugins()
    expect(blockRegistry.list()).toHaveLength(firstCount)
  })

  it('all plugins have components registered', () => {
    registerAllCardPlugins()
    for (const def of blockRegistry.list()) {
      expect(def.components).toBeDefined()
      expect(def.components!.card || def.components!.inline).toBeTruthy()
    }
  })
})
