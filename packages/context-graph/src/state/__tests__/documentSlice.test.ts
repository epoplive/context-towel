import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore, resetStore, clearPersistedState } from '../store'
import type { ParsedFileData } from '../../compat/services'

describe('context-graph document slice', () => {
  beforeEach(() => {
    clearPersistedState()
    resetStore()
  })

  it('stores parsed content for a document id', () => {
    const store = useGraphStore.getState()
    const parsed: ParsedFileData = {
      path: '/doc.md',
      content: '# Doc',
      lastModified: 1,
      results: new Map(),
    }

    store.setDocContentParsed('doc.md', parsed)

    const updated = useGraphStore.getState().docContents.get('doc.md')
    expect(updated?.content).toBe('# Doc')
  })

  it('clears document state when project changes', () => {
    const store = useGraphStore.getState()
    const parsed: ParsedFileData = {
      path: '/doc.md',
      content: '# Doc',
      lastModified: 1,
      results: new Map(),
    }

    store.setDocContentParsed('doc.md', parsed)
    store.setProjectPath('/next')

    expect(useGraphStore.getState().docContents.size).toBe(0)
    expect(useGraphStore.getState().treeItems.length).toBe(0)
  })
})
