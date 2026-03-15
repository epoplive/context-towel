import { useEffect, useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { initServices } from './initServices'

// Wire up real file service + parser before anything uses the graph
initServices()

import { ThemeProvider } from '@context-towel/context-graph/compat/design-system'
import { DocumentGraph } from '@context-towel/context-graph'
import { FileViewer } from './FileViewer'

type AppMode = 'landing' | 'file' | 'project'

export function App() {
  const [mode, setMode] = useState<AppMode>('landing')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [pathInput, setPathInput] = useState('')

  const openProject = useCallback((path: string) => {
    setProjectPath(path)
    setMode('project')
  }, [])

  const handlePathSubmit = useCallback(() => {
    const p = pathInput.trim()
    if (!p) return
    if (p.endsWith('.md') || p.endsWith('.markdown')) {
      setFilePath(p)
      setMode('file')
    } else {
      openProject(p)
    }
  }, [pathInput, openProject])

  const handleOpenProject = useCallback(async () => {
    const selected = await invoke<string | null>('open_directory_picker')
    if (selected) openProject(selected)
  }, [openProject])

  const handleOpenFile = useCallback(async () => {
    const selected = await invoke<string | null>('open_file_picker')
    if (selected) {
      setFilePath(selected)
      setMode('file')
    }
  }, [])

  const handleOpenFileFromGraph = useCallback((fp: string, _lineNumber?: number) => {
    setFilePath(fp)
    setMode('file')
  }, [])

  const handleBackToLanding = useCallback(() => {
    setMode('landing')
    setFilePath(null)
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
      .catch(() => {})

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  // File viewer mode
  if (mode === 'file' && filePath) {
    return <FileViewer filePath={filePath} onBack={handleBackToLanding} />
  }

  // Project graph mode + landing
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
          {projectPath && (
            <span style={{ color: '#4a9' }}>
              {projectPath.split('/').pop()}
            </span>
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

        {/* Graph or Landing */}
        <div style={{ flex: 1, position: 'relative' }}>
          {mode === 'project' && projectPath && (
            <ReactFlowProvider>
              <DocumentGraph
                projectPath={projectPath}
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
