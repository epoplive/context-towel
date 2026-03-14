import { useEffect, useState, useCallback, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
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
import { FileViewer } from './FileViewer'

type AppMode = 'landing' | 'file' | 'project'
type AppStatus = 'idle' | 'loading' | 'ready' | 'error'

export function App() {
  const [mode, setMode] = useState<AppMode>('landing')
  const [status, setStatus] = useState<AppStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [roots, setRoots] = useState<GraphRoot[]>([])
  const [filePath, setFilePath] = useState<string | null>(null)
  const [pathInput, setPathInput] = useState('')
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
      setMode('project')
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
      setStatus('error')
    }
  }, [])

  const handlePathSubmit = useCallback(async () => {
    const p = pathInput.trim()
    if (!p) return
    if (p.endsWith('.md') || p.endsWith('.markdown')) {
      setFilePath(p)
      setMode('file')
    } else {
      await loadProject(p)
    }
  }, [pathInput, loadProject])

  const handleOpenProject = useCallback(async () => {
    const selected = await invoke<string | null>('open_directory_picker')
    if (selected) {
      await loadProject(selected)
    }
  }, [loadProject])

  const handleOpenFile = useCallback(async () => {
    const selected = await invoke<string | null>('open_file_picker')
    if (selected) {
      setFilePath(selected)
      setMode('file')
    }
  }, [])

  const handleOpenFileFromGraph = useCallback((fp: string, lineNumber?: number) => {
    console.log('Open file:', fp, lineNumber)
  }, [])

  const handleBackToLanding = useCallback(() => {
    setMode('landing')
    setFilePath(null)
  }, [])

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (unwatchRef.current) {
        unwatchRef.current()
      }
    }
  }, [])

  // Listen for file-opened events from Tauri (file association / CLI args)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false

    listen<string>('file-opened', (event) => {
      setFilePath(event.payload)
      setMode('file')
    })
      .then(fn => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch(() => {
        // Not running inside Tauri (e.g. plain browser during dev)
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  // File viewer mode
  if (mode === 'file' && filePath) {
    return <FileViewer filePath={filePath} onBack={handleBackToLanding} />
  }

  // Project graph mode
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
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={handleOpenFile}
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
              Open File
            </button>
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
          {mode === 'project' && status === 'ready' && projectPath && (
            <ReactFlowProvider>
              <DocumentGraph
                projectPath={projectPath}
                graphRoots={roots}
                isVisible={true}
                onOpenFile={handleOpenFileFromGraph}
              />
            </ReactFlowProvider>
          )}

          {mode === 'landing' && (
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
                Open a markdown file or a project folder
              </div>
              <div style={{ display: 'flex', gap: 8, width: 480 }}>
                <input
                  type="text"
                  value={pathInput}
                  onChange={e => setPathInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePathSubmit() }}
                  placeholder="/path/to/file.md or /path/to/project"
                  style={{
                    flex: 1,
                    background: '#1a1a2e',
                    border: '1px solid #3a3a6a',
                    color: '#e0e0e0',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handlePathSubmit}
                  style={{
                    background: '#2a2a4a',
                    border: '1px solid #3a3a6a',
                    color: '#ccc',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Open
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleOpenFile}
                  style={{
                    background: 'transparent',
                    border: '1px solid #3a3a6a',
                    color: '#888',
                    padding: '6px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Browse File...
                </button>
                <button
                  onClick={handleOpenProject}
                  style={{
                    background: 'transparent',
                    border: '1px solid #3a3a6a',
                    color: '#888',
                    padding: '6px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Browse Project...
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
