import { useCallback, useMemo } from 'react'
import { fileService } from '../../../../compat/services'
import { useContextGraphController } from '../../../../hooks/useContextGraphController'
import { useGraphStore } from '../../../../state/store'
import type { TaskBoardPrefs } from '../../../../state/slices'
import type { TaskItem } from '../../types'
import { TaskBoardView } from './TaskBoardView'
import { updateTaskContent } from './taskContentUpdate'

// ============================================================================
// TASK BOARD (store-backed wrapper)
// ============================================================================

interface TaskBoardProps {
  tasks: TaskItem[]
  parentDocId: string
  taskListId: string
  view: 'focus' | 'normal'
}

export const TaskBoard = ({ tasks, parentDocId, taskListId, view }: TaskBoardProps) => {
  const taskBoardDefaults = useGraphStore(state => state.taskBoardDefaults)
  const taskBoardByList = useGraphStore(state => state.taskBoardByList)
  const setTaskBoardPrefs = useGraphStore(state => state.setTaskBoardPrefs)
  const docContents = useGraphStore(state => state.docContents)
  const treeItems = useGraphStore(state => state.treeItems)
  const setDocContentParsed = useGraphStore(state => state.setDocContentParsed)
  const controller = useContextGraphController()

  const defaults = taskBoardDefaults[view]
  const fallbackDefaults = taskBoardDefaults[view === 'focus' ? 'normal' : 'focus']
  const storedPrefs = taskBoardByList[taskListId]

  const effectivePrefs = useMemo<TaskBoardPrefs>(() => ({
    view: storedPrefs?.view ?? defaults.view ?? fallbackDefaults.view ?? 'list',
    groupBy: storedPrefs?.groupBy ?? defaults.groupBy ?? fallbackDefaults.groupBy ?? 'none',
    columnCount: storedPrefs?.columnCount ?? defaults.columnCount ?? fallbackDefaults.columnCount ?? 1,
    dependencyHeight: storedPrefs?.dependencyHeight ?? defaults.dependencyHeight ?? fallbackDefaults.dependencyHeight ?? 360,
    dependencyCardWidth: storedPrefs?.dependencyCardWidth ?? defaults.dependencyCardWidth ?? fallbackDefaults.dependencyCardWidth ?? 190,
    dependencyScrollX: storedPrefs?.dependencyScrollX ?? defaults.dependencyScrollX ?? fallbackDefaults.dependencyScrollX ?? 0,
    dependencyScrollY: storedPrefs?.dependencyScrollY ?? defaults.dependencyScrollY ?? fallbackDefaults.dependencyScrollY ?? 0,
    dependencyWidth: storedPrefs?.dependencyWidth ?? defaults.dependencyWidth ?? fallbackDefaults.dependencyWidth ?? 0,
  }), [defaults, fallbackDefaults, storedPrefs])

  const updateTaskField = useCallback(
    async (task: TaskItem, updates: { status?: TaskItem['status']; priority?: TaskItem['priority'] }) => {
      const doc = docContents.get(parentDocId)
      if (!doc) return
      const updated = updateTaskContent(doc.content, task, updates)
      if (!updated) return
      const item = treeItems.find(entry => entry.id === parentDocId)
      if (!item) return

      try {
        await fileService.write(item.path, updated)
        const parsed = await controller.parseContent(item.path, updated)
        setDocContentParsed(parentDocId, parsed)
      } catch (err) {
        console.error('Failed to save task update:', err)
      }
    },
    [controller, docContents, parentDocId, setDocContentParsed, treeItems]
  )

  return (
    <TaskBoardView
      tasks={tasks}
      parentDocId={parentDocId}
      taskListId={taskListId}
      prefs={effectivePrefs}
      onPrefsChange={(updates) => setTaskBoardPrefs(taskListId, updates)}
      onUpdateTaskField={updateTaskField}
    />
  )
}

