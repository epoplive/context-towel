import { ChevronRight, FileText } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { fileParserService, fileService } from '../compat/services'
import { useTheme } from '../compat/design-system'
import { layoutPrimitives } from '../compat/layoutPrimitives'
import { useContextTasks } from '../hooks'
import type { TaskBoardPrefs } from '../state/slices'
import type { TaskItem } from '../plugins/task/types'
import { TaskBoardView } from '../plugins/task/components/board/TaskBoardView'
import { updateTaskContent } from '../plugins/task/components/board/taskContentUpdate'

export type ContextTasksViewProps = {
  projectPath?: string
  onOpenFile?: (filePath: string, lineNumber?: number) => void
}

const DEFAULT_PREFS: TaskBoardPrefs = {
  view: 'board',
  groupBy: 'status',
  columnCount: 1,
  dependencyHeight: 360,
  dependencyCardWidth: 190,
  dependencyScrollX: 0,
  dependencyScrollY: 0,
  dependencyWidth: 0,
}

type FixStatus =
  | { state: 'idle' }
  | { state: 'running'; message: string }
  | { state: 'done'; message: string }
  | { state: 'error'; message: string }

function getBaseName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

export function ContextTasksView({ projectPath, onOpenFile }: ContextTasksViewProps) {
  const { colors } = useTheme()
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => new Set())
  const [prefsByList, setPrefsByList] = useState<Record<string, TaskBoardPrefs>>({})
  const [fixStatus, setFixStatus] = useState<FixStatus>({ state: 'idle' })

  const contextPath = projectPath ? `${projectPath}/.context/working` : null
  const {
    tasks,
    byFile: tasksByFile,
    loading: tasksLoading,
    error: tasksError,
    refresh,
  } = useContextTasks(contextPath, { autoWatch: true, initialParse: true })

  const fileEntries = useMemo(() => {
    const entries = Array.from(tasksByFile.entries())
      .map(([filePath, fileTasks]) => {
        const total = fileTasks.length
        const done = fileTasks.filter(t => t.status === 'done').length
        const blocked = fileTasks.filter(t => t.status === 'blocked').length
        const inProgress = fileTasks.filter(t => t.status === 'in-progress').length
        const open = total - done
        return {
          filePath,
          fileName: getBaseName(filePath),
          tasks: fileTasks,
          total,
          done,
          blocked,
          inProgress,
          open,
        }
      })
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
    return entries
  }, [tasksByFile])

  const toggleFile = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }, [])

  const updatePrefs = useCallback((taskListId: string, updates: Partial<TaskBoardPrefs>) => {
    setPrefsByList((prev) => {
      const current = prev[taskListId] ?? DEFAULT_PREFS
      return { ...prev, [taskListId]: { ...current, ...updates } }
    })
  }, [])

  const updateTaskField = useCallback(
    async (task: TaskItem, updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }) => {
      const filePath = task.sourceFile
      try {
        const content = await fileService.read(filePath)
        const updated = updateTaskContent(content, task, updates)
        if (!updated) return
        await fileService.write(filePath, updated)

        // Update parser cache immediately so subscribed UI updates without waiting for FS events.
        await fileParserService.parseContent(filePath, updated)
      } catch (err) {
        console.error('Failed to update task:', err)
      }
    },
    []
  )

  const handleFixIds = useCallback(async () => {
    if (!contextPath) return
    setFixStatus({ state: 'running', message: 'Scanning task blocks…' })
    try {
      const { fixContextTaskIds } = await import('../plugins/task/idFixer')
      const result = await fixContextTaskIds(contextPath)
      const warningCount = result.warnings.length
      const messageParts = [
        `${result.fixes.length} ids added`,
        `${result.updatedFiles.length} files updated`,
        warningCount > 0 ? `${warningCount} warning${warningCount > 1 ? 's' : ''}` : null,
      ].filter(Boolean)
      setFixStatus({ state: 'done', message: messageParts.join(' • ') })

      // Refresh once so the UI reflects new IDs immediately.
      await refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fix task IDs'
      setFixStatus({ state: 'error', message })
    }
  }, [contextPath, refresh])

  if (!projectPath) {
    return (
      <div style={{ padding: '12px', fontSize: '12px', color: colors.textMuted }}>
        Select a project
      </div>
    )
  }

  const projectTaskCount = tasks.length

  return (
    <div style={{ ...layoutPrimitives.fillColumn, padding: '12px', gap: '10px', overflow: 'auto', background: colors.bgPrimary }}>
      <div style={{ ...layoutPrimitives.row, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ ...layoutPrimitives.column, gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.textPrimary }}>Tasks</span>
          <span style={{ fontSize: 10, color: colors.textMuted }}>Task blocks parsed from .context/working</span>
        </div>
        <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleFixIds}
            disabled={fixStatus.state === 'running'}
            style={{
              border: `1px solid ${colors.borderPrimary}`,
              background: fixStatus.state === 'running' ? colors.bgTertiary : colors.bgSecondary,
              color: colors.textPrimary,
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 10,
              cursor: fixStatus.state === 'running' ? 'not-allowed' : 'pointer',
            }}
          >
            {fixStatus.state === 'running' ? 'Fixing…' : 'Fix IDs'}
          </button>
          <span style={{ fontSize: 10, color: colors.textMuted }}>
            {projectTaskCount} tasks
          </span>
        </div>
      </div>

      {fixStatus.state !== 'idle' && 'message' in fixStatus && fixStatus.message && (
        <div style={{
          fontSize: 10,
          color: fixStatus.state === 'error' ? colors.error : colors.textMuted,
        }}>
          {fixStatus.message}
        </div>
      )}

      {tasksLoading && (
        <div style={{ fontSize: 11, color: colors.textMuted }}>Loading tasks…</div>
      )}

      {tasksError && (
        <div style={{ fontSize: 11, color: colors.error }}>{tasksError.message}</div>
      )}

      {!tasksLoading && !tasksError && fileEntries.length === 0 && (
        <div style={{ color: colors.textMuted, fontSize: 11 }}>
          No tasks found in .context/working
        </div>
      )}

      {fileEntries.length > 0 && (
        <div
          style={{
            ...layoutPrimitives.column,
            gap: 8,
            borderRadius: 8,
            border: `1px solid ${colors.borderPrimary}`,
            background: colors.bgSecondary,
            overflow: 'hidden',
          }}
        >
          {fileEntries.map((entry, index, arr) => {
            const isExpanded = expandedFiles.has(entry.filePath)
            const prefs = prefsByList[entry.filePath] ?? DEFAULT_PREFS

            return (
              <div
                key={entry.filePath}
                style={{
                  borderBottom: index < arr.length - 1 ? `1px solid ${colors.borderPrimary}` : 'none',
                }}
              >
                <div
                  onClick={() => toggleFile(entry.filePath)}
                  style={{
                    ...layoutPrimitives.row,
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: isExpanded ? colors.bgTertiary : colors.bgSecondary,
                  }}
                >
                  <span style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    color: colors.textMuted,
                    ...layoutPrimitives.row,
                    alignItems: 'center',
                  }}>
                    <ChevronRight size={12} />
                  </span>
                  <FileText size={14} style={{ color: colors.info }} />
                  <span style={{
                    flex: 1,
                    color: colors.textPrimary,
                    fontSize: 12,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.fileName}
                  </span>
                  <div style={{ ...layoutPrimitives.row, gap: 6 }}>
                    {entry.open > 0 && (
                      <span style={{
                        background: colors.accent,
                        color: colors.textInverse,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {entry.open} open
                      </span>
                    )}
                    {entry.inProgress > 0 && (
                      <span style={{
                        background: colors.info,
                        color: colors.textInverse,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {entry.inProgress} active
                      </span>
                    )}
                    {entry.blocked > 0 && (
                      <span style={{
                        background: colors.warning,
                        color: colors.textInverse,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {entry.blocked} blocked
                      </span>
                    )}
                    {entry.done > 0 && (
                      <span style={{
                        background: colors.success,
                        color: colors.textInverse,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        ✓{entry.done}
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '10px 12px', background: colors.bgPrimary }}>
                    <TaskBoardView
                      tasks={entry.tasks}
                      parentDocId={entry.filePath}
                      taskListId={entry.filePath}
                      prefs={prefs}
                      onPrefsChange={(updates) => updatePrefs(entry.filePath, updates)}
                      onUpdateTaskField={updateTaskField}
                      onOpenFile={onOpenFile}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
