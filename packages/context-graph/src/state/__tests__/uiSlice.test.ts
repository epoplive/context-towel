import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore, resetStore, clearPersistedState } from '../store'

describe('context-graph UI slice', () => {
  beforeEach(() => {
    clearPersistedState()
    resetStore()
  })

  it('toggles pinned nodes', () => {
    const store = useGraphStore.getState()

    store.togglePinnedNode('doc.md')
    expect(useGraphStore.getState().pinnedNodes.has('doc.md')).toBe(true)

    store.togglePinnedNode('doc.md')
    expect(useGraphStore.getState().pinnedNodes.has('doc.md')).toBe(false)
  })

  it('toggles locked nodes', () => {
    const store = useGraphStore.getState()

    store.toggleLockedNode('doc.md')
    expect(useGraphStore.getState().lockedNodes.has('doc.md')).toBe(true)

    store.toggleLockedNode('doc.md')
    expect(useGraphStore.getState().lockedNodes.has('doc.md')).toBe(false)
  })
})
