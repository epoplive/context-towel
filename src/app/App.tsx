import { useEffect, useState, useCallback, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { open } from '@tauri-apps/plugin-dialog'
import { ThemeProvider } from '@context-towel/context-graph/compat/design-system'
import { DocumentGraph, useGraphStore } from '@context-towel/context-graph'
import type { GraphRoot } from '@context-towel/context-graph'
import {
  walkProjectTree,
  readAllMarkdownFiles,
  detectGraphRoots,
  readFileContent,
  watchProject,
} from './tauriFileService'

type AppStatus = 'idle' | 'loading' | 'ready' | 'error'

export function App() {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [roots, setRoots] = useState<GraphRoot[]>([])
  const unwatchRef = useRef<(() => void) | null>(null)

  const loadProject = useCallback(async (path: string) => {
    try {
      setStatus('loading')
      setError(null)

      // Clean up previous watcher
      if (unwatchRef.current) {
        unwatchRef.current()
        unwatchRef.current = null
      }

      // Walk the project tree
      const treeItems = await walkProjectTree(path)
      const graphRoots = await detectGraphRoots(path)

      // Load tree into store
      const store = useGraphStore.getState()
      store.setTreeItems(treeItems)

      // Read all markdown file contents
      const files = await readAllMarkdownFiles(treeItems)
      for (const file of files) {
        store.setDocContent(file.id, file.content)
      }

      // Set up file watcher
      const unwatch = await watchProject(path, async (changedPaths) => {
        for (const changedPath of changedPaths) {
          // Only care about markdown files
          if (!changedPath.endsWith('.md')) continue

          const relativePath = changedPath.startsWith(path + '/')
            ? changedPath.slice(path.length + 1)
            : changedPath

          const content = await readFileContent(changedPath)
          if (content !== null) {
            useGraphStore.getState().setDocContent(relativePath, content)
          }
        }

        // Also refresh the tree in case files were added/removed
        const newTreeItems = await walkProjectTree(path)
        useGraphStore.getState().setTreeItems(newTreeItems)
      })
      unwatchRef.current = unwatch

      setProjectPath(path)
      setRoots(graphRoots)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
      setStatus('error')
    }
  }, [])

  const handleOpenProject = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false })
    if (selected) {
      await loadProject(selected)
    }
  }, [loadProject])

  const handleOpenFile = useCallback((filePath: string, lineNumber?: number) => {
    console.log('Open file:', filePath, lineNumber)
    // TODO: open in system editor or built-in editor
  }, [])

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (unwatchRef.current) {
        unwatchRef.current()
      }
    }
  }, [])

  // Auto-load if project path passed via CLI args (future)
  // For now, show the open dialog on first launch
  useEffect(() => {
    if (status === 'idle') {
      handleOpenProject()
    }
  }, [status, handleOpenProject])

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
        {/* Title bar */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #2a2a4a',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          userSelect: 'none',
        }}>
          <strong>Context Towel</strong>
          {status === 'loading' && (
            <span style={{ color: '#888' }}>Loading...</span>
          )}
          {status === 'ready' && projectPath && (
            <span style={{ color: '#4a9' }}>
              {projectPath.split('/').pop()}
            </span>
          )}
          {status === 'error' && (
            <span style={{ color: '#e55' }}>Error: {error}</span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleOpenProject}
              style={{
                background: '#2a2a4a',
                border: '1px solid #3a3a6a',
                color: '#ccc',
                padding: '4px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Open Project
            </button>
          </div>
        </div>

        {/* Graph */}
        <div style={{ flex: 1, position: 'relative' }}>
          {status === 'ready' && projectPath && (
            <ReactFlowProvider>
              <DocumentGraph
                projectPath={projectPath}
                graphRoots={roots}
                isVisible={true}
                onOpenFile={handleOpenFile}
              />
            </ReactFlowProvider>
          )}

          {status === 'idle' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 16,
            }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>42</div>
              <div style={{ color: '#666', fontSize: 14 }}>
                Open a project to view its context graph
              </div>
              <button
                onClick={handleOpenProject}
                style={{
                  background: '#2a2a4a',
                  border: '1px solid #3a3a6a',
                  color: '#ccc',
                  padding: '8px 24px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Open Project
              </button>
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
