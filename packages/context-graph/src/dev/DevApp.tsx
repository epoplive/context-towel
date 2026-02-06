import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ThemeProvider } from '../compat/design-system/ThemeProvider'
import { DocumentGraph } from '../components/DocumentGraph'
import { useGraphStore } from '../state/store'
import type { TreeItem } from '../types'
import type { GraphRoot } from '../components/document-graph/paths'

export function DevApp() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [roots, setRoots] = useState<GraphRoot[]>([])
  const [projectPath, setProjectPath] = useState('/project')

  useEffect(() => {
    loadProject()
  }, [])

  async function loadProject() {
    try {
      setStatus('loading')

      // Fetch tree, roots in parallel
      const [treeRes, rootsRes] = await Promise.all([
        fetch('/api/tree'),
        fetch('/api/roots'),
      ])

      if (!treeRes.ok || !rootsRes.ok) {
        throw new Error('Failed to fetch project data')
      }

      const treeItems: TreeItem[] = await treeRes.json()
      const graphRoots: GraphRoot[] = await rootsRes.json()

      // Derive project path from the first root
      if (graphRoots.length > 0) {
        const rootPath = graphRoots[0].path
        // Project path is the parent of the .context root
        const projPath = rootPath.replace(/\/.context$/, '')
        setProjectPath(projPath)
      }

      // Load the store with tree items
      const store = useGraphStore.getState()
      store.setTreeItems(treeItems)

      // Fetch content for all markdown files
      const mdFiles = treeItems.filter(
        (item) => !item.is_dir && item.name.endsWith('.md')
      )

      const contentResults = await Promise.all(
        mdFiles.map(async (file) => {
          try {
            const res = await fetch(`/api/file?path=${encodeURIComponent(file.id)}`)
            if (!res.ok) return null
            const data = await res.json()
            return { id: file.id, content: data.content as string }
          } catch {
            return null
          }
        })
      )

      // Push content into store
      for (const result of contentResults) {
        if (result) {
          store.setDocContent(result.id, result.content)
        }
      }

      setRoots(graphRoots)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <ThemeProvider>
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#0d0d1a',
        color: '#e0e0e0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #2a2a4a',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <strong>Context Towel</strong>
          <span style={{ color: '#606070' }}>Dev Server</span>
          {status === 'loading' && (
            <span style={{ color: '#888' }}>Loading project...</span>
          )}
          {status === 'ready' && (
            <span style={{ color: '#4a9' }}>
              {projectPath}
            </span>
          )}
          {status === 'error' && (
            <span style={{ color: '#e55' }}>
              Error: {error}
            </span>
          )}
          <button
            onClick={loadProject}
            style={{
              marginLeft: 'auto',
              background: '#2a2a4a',
              border: '1px solid #3a3a6a',
              color: '#ccc',
              padding: '4px 12px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Reload
          </button>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          {status === 'ready' && (
            <ReactFlowProvider>
              <DocumentGraph
                projectPath={projectPath}
                graphRoots={roots}
                isVisible={true}
                onOpenFile={(path, line) => {
                  console.log('Open file:', path, line)
                }}
              />
            </ReactFlowProvider>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
