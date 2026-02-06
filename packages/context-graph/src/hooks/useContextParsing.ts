/**
 * useContextParsing - React hooks for context-graph file parsing
 *
 * These hooks subscribe to FileParserService caches; background watchers
 * should be managed by the app-level parsing service (not by views).
 *
 * Usage:
 *   // Get all tasks from a project's context folder
 *   const { tasks, loading } = useContextTasks('/path/to/project/.context')
 *
 *   // Get all parsed content types
 *   const { tasks, checklists, diagrams, toc, logs } = useAllContextParsing('/path/to/project/.context')
 */

import { useMemo } from 'react'
import { useFileParsing, type UseFileParsingResult } from '../compat/useFileParsing'
import { registerContextGraphParsers } from '../plugins/fileParserAdapter'
// Import from /types directly to avoid circular dependency through plugin components
import type { TaskItem } from '../plugins/task/types'
import type { ChecklistGroup } from '../plugins/checklist/types'
import type { DiagramItem } from '../plugins/diagram/types'
import type { TocSection } from '../plugins/toc/types'
import type { LogSection } from '../plugins/log/types'

// Lazy registration of context-graph parsers with FileParserService
// Done here to avoid circular dependency in store.ts
let parsersRegistered = false
let parsersRegistrationPromise: Promise<void> | null = null
function ensureParsersRegistered(): Promise<void> {
  if (!parsersRegistered) {
    parsersRegistered = true
    parsersRegistrationPromise = registerContextGraphParsers()
  }
  return parsersRegistrationPromise ?? Promise.resolve()
}
// Fire off registration immediately (non-blocking)
void ensureParsersRegistered()

export interface UseContextTasksResult {
  tasks: TaskItem[]
  byFile: Map<string, TaskItem[]>
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Hook for subscribing to parsed tasks from a context directory
 */
export function useContextTasks(
  contextPath: string | null,
  options?: { autoWatch?: boolean; initialParse?: boolean }
): UseContextTasksResult {
  ensureParsersRegistered()
  const result = useFileParsing<TaskItem>(
    'task',
    contextPath || '',
    {
      autoWatch: options?.autoWatch ?? false,
      initialParse: options?.initialParse ?? false,
      owner: 'context-tasks',
    }
  )

  return {
    tasks: result.items,
    byFile: result.byFile,
    loading: result.loading,
    error: result.error,
    refresh: result.refresh,
  }
}

/**
 * Hook for subscribing to parsed checklists from a context directory
 */
export function useContextChecklists(
  contextPath: string | null,
  options?: { autoWatch?: boolean; initialParse?: boolean }
): UseFileParsingResult<ChecklistGroup> {
  ensureParsersRegistered()
  return useFileParsing<ChecklistGroup>(
    'checklist',
    contextPath || '',
    {
      autoWatch: options?.autoWatch ?? false,
      initialParse: options?.initialParse ?? false,
      owner: 'context-checklists',
    }
  )
}

/**
 * Hook for subscribing to parsed diagrams from a context directory
 */
export function useContextDiagrams(
  contextPath: string | null,
  options?: { autoWatch?: boolean; initialParse?: boolean }
): UseFileParsingResult<DiagramItem> {
  ensureParsersRegistered()
  return useFileParsing<DiagramItem>(
    'diagram',
    contextPath || '',
    {
      autoWatch: options?.autoWatch ?? false,
      initialParse: options?.initialParse ?? false,
      owner: 'context-diagrams',
    }
  )
}

/**
 * Hook for subscribing to parsed table of contents from a context directory
 */
export function useContextToc(
  contextPath: string | null,
  options?: { autoWatch?: boolean; initialParse?: boolean }
): UseFileParsingResult<TocSection> {
  ensureParsersRegistered()
  return useFileParsing<TocSection>(
    'toc',
    contextPath || '',
    {
      autoWatch: options?.autoWatch ?? false,
      initialParse: options?.initialParse ?? false,
      owner: 'context-toc',
    }
  )
}

/**
 * Hook for subscribing to parsed log entries from a context directory
 */
export function useContextLogs(
  contextPath: string | null,
  options?: { autoWatch?: boolean; initialParse?: boolean }
): UseFileParsingResult<LogSection> {
  ensureParsersRegistered()
  return useFileParsing<LogSection>(
    'log',
    contextPath || '',
    {
      autoWatch: options?.autoWatch ?? false,
      initialParse: options?.initialParse ?? false,
      owner: 'context-logs',
    }
  )
}

/**
 * Combined result from all context parsers
 */
export interface UseAllContextParsingResult {
  tasks: TaskItem[]
  tasksByFile: Map<string, TaskItem[]>
  checklists: ChecklistGroup[]
  checklistsByFile: Map<string, ChecklistGroup[]>
  diagrams: DiagramItem[]
  diagramsByFile: Map<string, DiagramItem[]>
  toc: TocSection[]
  tocByFile: Map<string, TocSection[]>
  logs: LogSection[]
  logsByFile: Map<string, LogSection[]>
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Hook for subscribing to all parsed content types from a context directory.
 * This is useful for components that need access to multiple content types.
 */
export function useAllContextParsing(
  contextPath: string | null,
  options?: { autoWatch?: boolean; initialParse?: boolean }
): UseAllContextParsingResult {
  const taskResult = useContextTasks(contextPath, options)
  const checklistResult = useContextChecklists(contextPath, options)
  const diagramResult = useContextDiagrams(contextPath, options)
  const tocResult = useContextToc(contextPath, options)
  const logResult = useContextLogs(contextPath, options)

  // Combined refresh function
  const refresh = useMemo(
    () => async () => {
      await Promise.all([
        taskResult.refresh(),
        checklistResult.refresh(),
        diagramResult.refresh(),
        tocResult.refresh(),
        logResult.refresh(),
      ])
    },
    [taskResult, checklistResult, diagramResult, tocResult, logResult]
  )

  // Combined loading state (any loading = overall loading)
  const loading =
    taskResult.loading ||
    checklistResult.loading ||
    diagramResult.loading ||
    tocResult.loading ||
    logResult.loading

  // First error encountered
  const error =
    taskResult.error ||
    checklistResult.error ||
    diagramResult.error ||
    tocResult.error ||
    logResult.error

  return {
    tasks: taskResult.tasks,
    tasksByFile: taskResult.byFile,
    checklists: checklistResult.items,
    checklistsByFile: checklistResult.byFile,
    diagrams: diagramResult.items,
    diagramsByFile: diagramResult.byFile,
    toc: tocResult.items,
    tocByFile: tocResult.byFile,
    logs: logResult.items,
    logsByFile: logResult.byFile,
    loading,
    error,
    refresh,
  }
}
