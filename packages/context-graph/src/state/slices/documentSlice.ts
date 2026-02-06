// ============================================================================
// Context Graph State - Document Slice
// ============================================================================

import type { DocumentSlice, SliceCreator, ParsedDocContent } from './types'
import type { TocSection } from '../../plugins/toc/types'
import type { TaskItem } from '../../plugins/task/types'
import type { ChecklistGroup } from '../../plugins/checklist/types'
import type { DiagramItem } from '../../plugins/diagram/types'
import type { LogSection } from '../../plugins/log/types'
import type { LinkItem } from '../../plugins/link/types'
import type { ParsedFileData } from '../../compat/services'
import { pluginRegistry } from '../../plugins/registry'
import { normalizeProjectSettings } from '../../compat/project-settings'

// Convert plugin parse results to our ParsedDocContent format
// Uses pluginRegistry directly to avoid circular dependency through plugins/index.ts
function parseDocument(content: string, sourceFile: string): ParsedDocContent {
  const results = pluginRegistry.parseAll(content, sourceFile)

  // Extract results from the Map by plugin id (must match plugin.id exactly!)
  // Plugin parsers return { items: T[], ... } in ParseResult format
  const tocResult = results.get('toc') as { items?: TocSection[] } | undefined
  const taskResult = results.get('task') as { items?: TaskItem[] } | undefined
  const checklistResult = results.get('checklist') as { items?: ChecklistGroup[] } | undefined
  const diagramResult = results.get('diagram') as { items?: DiagramItem[] } | undefined
  const linkResult = results.get('link') as { items?: LinkItem[] } | undefined

  return {
    content,
    sections: tocResult?.items || [],
    tasks: taskResult?.items || [],
    checklists: checklistResult?.items || [],
    diagrams: diagramResult?.items || [],
    links: linkResult?.items || [],
    extractions: results as Map<string, import('../../types').ParseResult<import('../../types').ExtractedItem>>,
  }
}

// Convert FileParserService's ParsedFileData to our ParsedDocContent format
// This avoids re-parsing when data comes from FileParserService
function convertParsedFileData(data: ParsedFileData): ParsedDocContent {
  const tocResult = data.results.get('toc') as { items?: TocSection[] } | undefined
  const taskResult = data.results.get('task') as { items?: TaskItem[] } | undefined
  const checklistResult = data.results.get('checklist') as { items?: ChecklistGroup[] } | undefined
  const diagramResult = data.results.get('diagram') as { items?: DiagramItem[] } | undefined
  const logResult = data.results.get('log') as { items?: LogSection[] } | undefined
  const linkResult = data.results.get('link') as { items?: LinkItem[] } | undefined

  return {
    content: data.content,
    sections: tocResult?.items || [],
    tasks: taskResult?.items || [],
    checklists: checklistResult?.items || [],
    diagrams: diagramResult?.items || [],
    logs: logResult?.items || [],
    links: linkResult?.items || [],
    extractions: data.results as Map<string, import('../../types').ParseResult<import('../../types').ExtractedItem>>,
  }
}

// Simple hash function for content change detection
function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export const createDocumentSlice: SliceCreator<DocumentSlice> = (set, get) => ({
  // Initial state
  projectPath: null,
  projectSettings: normalizeProjectSettings(undefined),
  treeItems: [],
  docContents: new Map(),
  contentHashes: new Map(),

  // Actions
  setProjectPath: (path) => {
    set({
      projectPath: path,
      treeItems: [],
      docContents: new Map(),
      contentHashes: new Map(),
    })
  },

  setProjectSettings: (settings) => {
    set({ projectSettings: normalizeProjectSettings(settings) })
  },

  setTreeItems: (items) => {
    set({ treeItems: items })
  },

  setDocContent: (id, content) => {
    const { docContents, contentHashes } = get()
    const newHash = hashContent(content)
    const existingHash = contentHashes.get(id)

    // Skip if content hasn't changed
    if (existingHash === newHash) {
      return
    }

    // Parse the document
    const parsed = parseDocument(content, id)

    // Update state
    const newDocContents = new Map(docContents)
    newDocContents.set(id, parsed)

    const newContentHashes = new Map(contentHashes)
    newContentHashes.set(id, newHash)

    set({
      docContents: newDocContents,
      contentHashes: newContentHashes,
    })
  },

  setDocContentParsed: (id, data) => {
    const { docContents, contentHashes } = get()
    const newHash = hashContent(data.content)
    const existingHash = contentHashes.get(id)

    // Skip if content hasn't changed
    if (existingHash === newHash) {
      return
    }

    // Convert from FileParserService format (already parsed, no re-parsing!)
    const parsed = convertParsedFileData(data)

    // Update state
    const newDocContents = new Map(docContents)
    newDocContents.set(id, parsed)

    const newContentHashes = new Map(contentHashes)
    newContentHashes.set(id, newHash)

    set({
      docContents: newDocContents,
      contentHashes: newContentHashes,
    })
  },

  toggleCheckbox: (docId, checklistIndex, itemIndex, checked) => {
    const { docContents } = get()
    const doc = docContents.get(docId)
    if (!doc) return

    // Update the checkbox in checklists
    const updatedChecklists = doc.checklists.map((group, gIdx) => ({
      ...group,
      items: group.items.map((item, iIdx) =>
        gIdx === checklistIndex && iIdx === itemIndex ? { ...item, checked } : item
      ),
    }))

    const newDocContents = new Map(docContents)
    newDocContents.set(docId, {
      ...doc,
      checklists: updatedChecklists,
    })

    set({ docContents: newDocContents })
  },

  clearDocuments: () => {
    set({
      treeItems: [],
      docContents: new Map(),
      contentHashes: new Map(),
    })
  },
})

// Selectors
export const documentSelectors = {
  selectProjectPath: (state: { projectPath: string | null }) => state.projectPath,
  selectProjectSettings: (state: { projectSettings: ReturnType<typeof normalizeProjectSettings> }) => state.projectSettings,
  selectTreeItems: (state: { treeItems: import('./types').TreeItem[] }) => state.treeItems,
  selectDocContents: (state: { docContents: Map<string, ParsedDocContent> }) => state.docContents,
  selectDocContent: (id: string) => (state: { docContents: Map<string, ParsedDocContent> }) => state.docContents.get(id),
  selectHasDocument: (id: string) => (state: { docContents: Map<string, ParsedDocContent> }) => state.docContents.has(id),
  selectContentHash: (id: string) => (state: { contentHashes: Map<string, string> }) => state.contentHashes.get(id),
}
