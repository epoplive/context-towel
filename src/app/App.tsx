import { useEffect, useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { initServices } from './initServices'
import './print.css'

// Wire up real file service + parser before anything uses the graph
initServices()

import { ThemeProvider } from '@context-towel/context-graph/compat/design-system'
import { DocumentGraph } from '@context-towel/context-graph'
import { FileViewer, FileViewerInner, EmbeddedDocHeaderControls } from './FileViewer'
import { writeFileContent } from './tauriFileService'
import { useThemeStore, type ThemePreference } from './theme-store'
import { FontSettings } from './FontSettings'

type AppMode = 'landing' | 'file' | 'project'

const prefLabels: Record<ThemePreference, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}
const prefCycle: ThemePreference[] = ['dark', 'light', 'system']

export function App() {
  const [mode, setMode] = useState<AppMode>('landing')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [pathInput, setPathInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const theme = useThemeStore(s => s.resolved)
  const preference = useThemeStore(s => s.preference)
  const setPreference = useThemeStore(s => s.setPreference)
  const colors = theme.colors

  const cycleTheme = useCallback(() => {
    const idx = prefCycle.indexOf(preference)
    setPreference(prefCycle[(idx + 1) % prefCycle.length])
  }, [preference, setPreference])

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

    // Check for a file that arrived before this listener was ready (cold start).
    // macOS delivers the file URL via Apple Event which may arrive after the
    // webview loads, so we poll a few times.
    const checkPending = () => {
      invoke<string | null>('get_pending_file').then(pending => {
        if (!cancelled && pending) {
          setFilePath(pending)
          setMode('file')
        }
      }).catch(() => {})
    }
    checkPending()
    const t1 = setTimeout(checkPending, 300)
    const t2 = setTimeout(checkPending, 800)
    const t3 = setTimeout(checkPending, 1500)

    return () => {
      cancelled = true
      unlisten?.()
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  // File viewer mode — standalone, owns its own controls
  if (mode === 'file' && filePath) {
    return <FileViewer filePath={filePath} onBack={handleBackToLanding} />
  }

  const btnStyle = {
    background: colors.buttonBg,
    border: `1px solid ${colors.borderSecondary}`,
    color: colors.textSecondary,
    padding: '4px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  }

  // Project graph mode + landing
  return (
    <ThemeProvider theme={theme}>
      <div style={{
        width: '100vw',
        height: '100vh',
        background: colors.bgPrimary,
        color: colors.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Title bar */}
        <div style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${colors.borderPrimary}`,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          userSelect: 'none',
          flexShrink: 0,
          background: colors.bgSecondary,
        }}>
          <strong>Context Towel</strong>
          {projectPath && (
            <span style={{ color: colors.accent }}>
              {projectPath.split('/').pop()}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Theme preference toggle */}
            <button onClick={cycleTheme} style={btnStyle} title={`Theme: ${prefLabels[preference]}`}>
              {preference === 'dark' ? '🌙' : preference === 'light' ? '☀️' : '💻'}{' '}
              {prefLabels[preference]}
            </button>

            {/* Font settings */}
            <button
              onClick={() => setSettingsOpen(o => !o)}
              style={{
                ...btnStyle,
                background: settingsOpen ? colors.accent : colors.buttonBg,
                color: settingsOpen ? colors.textInverse : colors.textSecondary,
              }}
              title="Typography settings"
            >
              Aa
            </button>

            <button onClick={handleOpenFile} style={btnStyle}>Open File</button>
            <button onClick={handleOpenProject} style={btnStyle}>Open Project</button>
          </div>
        </div>

        {/* FontSettings slide-out panel */}
        {settingsOpen && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 560,
            background: colors.bgSecondary,
            borderLeft: `1px solid ${colors.borderPrimary}`,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: `-4px 0 20px ${colors.bgOverlay}`,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              borderBottom: `1px solid ${colors.borderPrimary}`,
              flexShrink: 0,
            }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Typography Settings</span>
              <button
                onClick={() => setSettingsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '2px 6px',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <FontSettings />
            </div>
          </div>
        )}

        {/* Graph or Landing */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {mode === 'project' && projectPath && (
            <ReactFlowProvider>
              <DocumentGraph
                projectPath={projectPath}
                isVisible={true}
                onOpenFile={handleOpenFileFromGraph}
                onWriteFile={(path: string, content: string) => { void writeFileContent(path, content) }}
                renderDocumentView={(fp: string) => (
                  <FileViewerInner filePath={fp} hideAppControls hideToolbar />
                )}
                renderDocumentHeaderControls={(fp: string) => (
                  <EmbeddedDocHeaderControls filePath={fp} />
                )}
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
              <div style={{ color: colors.textMuted, fontSize: 14 }}>
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
                    background: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    color: colors.textPrimary,
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button onClick={handlePathSubmit} style={{ ...btnStyle, padding: '8px 16px', borderRadius: 6, fontSize: 13 }}>
                  Open
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleOpenFile}
                  style={{ ...btnStyle, background: 'transparent', color: colors.textMuted, borderRadius: 6, padding: '6px 16px' }}
                >
                  Browse File...
                </button>
                <button
                  onClick={handleOpenProject}
                  style={{ ...btnStyle, background: 'transparent', color: colors.textMuted, borderRadius: 6, padding: '6px 16px' }}
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
