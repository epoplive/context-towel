import { beforeEach, describe, expect, it } from 'vitest'
import type { TreeItem } from '../../types'
import { clearPersistedState, resetStore, useGraphStore } from '../store'
import { ensurePluginsRegisteredSync } from '../pluginInit'

describe('link-card graph behavior', () => {
  beforeEach(() => {
    clearPersistedState()
    resetStore()
  })

  it('creates a link-card breakout node and draws edges without using link-stub', async () => {
    await ensurePluginsRegisteredSync()

    const store = useGraphStore.getState()
    store.setProjectPath('/proj')

    const treeItems: TreeItem[] = [
      { id: 'docs', name: 'docs', path: '/proj/docs', is_dir: true },
      { id: 'docs/a.md', name: 'a.md', path: '/proj/docs/a.md', is_dir: false },
      { id: 'docs/b.md', name: 'b.md', path: '/proj/docs/b.md', is_dir: false },
    ]
    store.setTreeItems(treeItems)

    // Select the doc so the graph will include the link-card breakout node.
    store.setSelectedNodes(['docs/a.md'])

    store.setDocContent('docs/a.md', 'See [[docs/b.md]]')
    store.setDocContent('docs/b.md', '# B')

    store.rebuildGraph(true)

    const { nodes, edges } = useGraphStore.getState()

    const linkCardId = 'docs/a.md#links'
    const linkCard = nodes.find((n) => n.id === linkCardId)
    expect(linkCard?.type).toBe('link-card')

    expect(nodes.some((n) => n.type === 'link-stub')).toBe(false)

    // Breakout structural edge from doc -> link-card.
    expect(edges.some((e) => e.id === `docs/a.md->${linkCardId}` && e.data?.edgeType === 'structural')).toBe(true)

    // Direct dashed link edge between internal doc nodes.
    expect(edges.some((e) => e.id === 'docs/a.md=>docs/b.md' && e.data?.edgeType === 'link')).toBe(true)
  })
})

