// ============================================================================
// Context Instruction Auto-Writer
// ============================================================================

import { fileService as defaultFileService, packetService as defaultPacketService } from '../compat/services'
import type { PacketServiceInterface } from '../compat/services'
import { useGraphStore } from '../state'
import type { StoreState, ParsedDocContent } from '../state'
import type { ExtractedItem, ParseResult, ParsedDocument, WorkspaceState } from '../types'
import { generateAgentsMd, generateClaudeMd, generateGeminiMd, injectPacketIntoContent, removePacketSection } from './generator'
import { pluginRegistry } from '../plugins/registry'
import { normalizeProjectPath } from '../compat/projectIdentity'

export type InstructionTarget = {
  path: string
  kind: 'claude' | 'agents' | 'gemini'
}

export type InstructionWriterDeps = {
  fileService?: Pick<typeof defaultFileService, 'exists' | 'read' | 'write'>
  packetService?: PacketServiceInterface
  getTargets?: (projectPath: string) => InstructionTarget[]
  createMissing?: boolean
  debounceMs?: number
}

const defaultTargets = (projectPath: string): InstructionTarget[] => [
  { path: `${projectPath}/CLAUDE.md`, kind: 'claude' },
  { path: `${projectPath}/AGENTS.md`, kind: 'agents' },
  { path: `${projectPath}/GEMINI.md`, kind: 'gemini' },
]

const buildExtractions = (doc: ParsedDocContent, sourceFile: string): Map<string, ParseResult<ExtractedItem>> => {
  if (doc.extractions) {
    return doc.extractions as Map<string, ParseResult<ExtractedItem>>
  }
  return pluginRegistry.parseAll(doc.content, sourceFile) as Map<string, ParseResult<ExtractedItem>>
}

export const buildWorkspaceStateFromGraph = (state: StoreState): WorkspaceState => {
  const treePathById = new Map(state.treeItems.map(item => [item.id, item.path]))
  const documents = new Map<string, ParsedDocument>()

  state.docContents.forEach((doc, id) => {
    documents.set(id, {
      id,
      path: treePathById.get(id) ?? id,
      content: doc.content,
      extractions: buildExtractions(doc, id),
    })
  })

  const expandedPanel = state.expandedPanel && state.expandedPanel.length > 0
    ? state.expandedPanel
    : null
  const expandedPanels = Array.from(state.expandedPanels)
  if (expandedPanel && !expandedPanels.includes(expandedPanel)) {
    expandedPanels.push(expandedPanel)
  }

  const focusMode = state.customFocusNodes && state.customFocusNodes.length > 0
    ? 'custom'
    : state.focusedNode
      ? 'single'
      : 'full'

  return {
    projectPath: state.projectPath,
    treeItems: state.treeItems,
    documents,
    focus: {
      mode: focusMode,
      focusedNodeId: state.focusedNode,
      customNodeIds: state.customFocusNodes ?? [],
    },
    collapsedFolders: state.collapsedFolders,
    treeWidgetFolders: state.treeWidgetFolders,
    openPanels: expandedPanels,
    expandedPanel,
    visibleSection: null,
    quickPreviewNode: state.quickPreviewNode,
    cardScale: state.cardScale,
  }
}

const generateContent = (target: InstructionTarget, state: WorkspaceState, existing: string): string => {
  if (target.kind === 'agents') {
    return generateAgentsMd(state, existing)
  }
  if (target.kind === 'gemini') {
    return generateGeminiMd(state, existing)
  }
  return generateClaudeMd(state, existing)
}

export async function syncInstructionFiles(
  projectPath: string,
  state: WorkspaceState,
  deps: InstructionWriterDeps = {}
): Promise<Array<{ path: string; updated: boolean }>> {
  const fs = deps.fileService ?? defaultFileService
  const pktSvc = deps.packetService ?? defaultPacketService
  const targets = (deps.getTargets ?? defaultTargets)(projectPath)
  const createMissing = deps.createMissing ?? false
  const results: Array<{ path: string; updated: boolean }> = []

  // Get active packet content once (may be null)
  let packetContent: string | null = null
  try {
    packetContent = await pktSvc.getInjectionContent()
  } catch {
    // Packet service not configured or failed — skip
  }

  for (const target of targets) {
    try {
      const exists = await fs.exists(target.path)
      if (!exists && !createMissing) {
        results.push({ path: target.path, updated: false })
        continue
      }
      const existing = exists ? await fs.read(target.path) : ''
      let updated = generateContent(target, state, existing)

      // Inject/remove packet section for claude targets
      if (target.kind === 'claude') {
        updated = packetContent
          ? injectPacketIntoContent(updated, packetContent)
          : removePacketSection(updated)
      }

      if (!exists || updated !== existing) {
        await fs.write(target.path, updated)
        results.push({ path: target.path, updated: true })
      } else {
        results.push({ path: target.path, updated: false })
      }
    } catch (error) {
      console.warn('[ContextGraph] Failed to sync instruction file', target.path, error)
      results.push({ path: target.path, updated: false })
    }
  }

  return results
}

export function createInstructionAutoWriter(deps: InstructionWriterDeps = {}) {
  const debounceMs = deps.debounceMs ?? 900

  return {
    start(projectPath: string | null): () => void {
      if (!projectPath) return () => {}
      const normalizedProject = normalizeProjectPath(projectPath)
      if (!normalizedProject) return () => {}

      let cancelled = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let syncInFlight = false

      const schedule = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(() => {
          timeoutId = null
          void runSync()
        }, debounceMs)
      }

      const runSync = async () => {
        if (cancelled || syncInFlight) return
        syncInFlight = true
        try {
          const snapshot = useGraphStore.getState()
          const storeProject = normalizeProjectPath(snapshot.projectPath)
          if (!storeProject || storeProject !== normalizedProject) {
            return
          }
          const workspaceState = buildWorkspaceStateFromGraph(snapshot)
          await syncInstructionFiles(normalizedProject, workspaceState, deps)
        } finally {
          syncInFlight = false
        }
      }

      const unsubscribe = useGraphStore.subscribe(
        (state) => ({
          projectPath: state.projectPath,
          treeItems: state.treeItems,
          docContents: state.docContents,
          focusedNode: state.focusedNode,
          customFocusNodes: state.customFocusNodes,
          expandedPanel: state.expandedPanel,
          expandedPanels: state.expandedPanels,
          collapsedFolders: state.collapsedFolders,
          treeWidgetFolders: state.treeWidgetFolders,
          quickPreviewNode: state.quickPreviewNode,
          cardScale: state.cardScale,
          activePacketId: state.activePacketId,
        }),
        schedule,
        {
          equalityFn: (a, b) => (
            a.projectPath === b.projectPath &&
            a.treeItems === b.treeItems &&
            a.docContents === b.docContents &&
            a.focusedNode === b.focusedNode &&
            a.customFocusNodes === b.customFocusNodes &&
            a.expandedPanel === b.expandedPanel &&
            a.expandedPanels === b.expandedPanels &&
            a.collapsedFolders === b.collapsedFolders &&
            a.treeWidgetFolders === b.treeWidgetFolders &&
            a.quickPreviewNode === b.quickPreviewNode &&
            a.cardScale === b.cardScale &&
            a.activePacketId === b.activePacketId
          ),
        }
      )

      schedule()

      return () => {
        cancelled = true
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
        unsubscribe()
      }
    },
  }
}
