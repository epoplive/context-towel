/**
 * Bridges a ChannelAdapter to the graph store.
 * Inbound messages update the store; store changes emit outbound messages.
 */

import { useEffect, useRef } from 'react'
import { useGraphStore } from '../state/store'
import type { ChannelAdapter, InboundMessage, ContextSnapshot } from '../channel'

export interface UseChannelBridgeOptions {
  /** Channel adapter (postMessage, direct, or custom) */
  channel: ChannelAdapter | null

  /** Callback when host requests opening a file */
  onOpenFile?: (path: string, line?: number) => void

  /** Whether to send context:update snapshots automatically */
  autoSyncContext?: boolean
}

/**
 * Hook that connects a ChannelAdapter to the graph store.
 *
 * Inbound:
 *   tree:update     → store.setTreeItems()
 *   content:update  → store.setDocContent()
 *   focus:set       → store.setFocusedNode()
 *   settings:update → store.setProjectSettings()
 *   roots:set       → (stored in ref, consumed by DocumentGraph)
 *
 * Outbound:
 *   Store changes   → context:update snapshot
 */
export function useChannelBridge({
  channel,
  onOpenFile,
  autoSyncContext = true,
}: UseChannelBridgeOptions) {
  const channelRef = useRef(channel)
  channelRef.current = channel

  // Handle inbound messages
  useEffect(() => {
    if (!channel) return

    const unsubscribe = channel.onMessage((msg: InboundMessage) => {
      const store = useGraphStore.getState()

      switch (msg.type) {
        case 'tree:update':
          store.setTreeItems(msg.items)
          break

        case 'content:update':
          for (const update of msg.updates) {
            store.setDocContent(update.path, update.content)
          }
          break

        case 'focus:set':
          store.setFocusedNode(msg.path)
          break

        case 'settings:update':
          // Map channel settings to store settings format
          store.setProjectSettings({
            stack: { languages: [], frameworks: [], orms: [], databases: [] },
            servers: [],
            commands: [],
            folders: {
              working: msg.settings.workingFolder ?? '.context/working',
              docs: msg.settings.docsFolder ?? '.context/docs',
              archive: msg.settings.archiveFolder ?? '.context/archive',
            },
          })
          break

        case 'roots:set':
          // Roots are consumed by the DocumentGraph component via props.
          // We don't store them in the graph store — the host passes them directly.
          break
      }
    })

    return unsubscribe
  }, [channel])

  // Auto-sync context snapshot outbound
  useEffect(() => {
    if (!channel || !autoSyncContext) return

    const unsubscribe = useGraphStore.subscribe(
      (state) => ({
        focusedNode: state.focusedNode,
        expandedPanels: state.expandedPanels,
        docContents: state.docContents,
      }),
      () => {
        const state = useGraphStore.getState()
        const snapshot = buildContextSnapshot(state)
        channelRef.current?.send({ type: 'context:update', snapshot })
      }
    )

    return unsubscribe
  }, [channel, autoSyncContext])

  // Helper to send outbound messages
  return {
    sendFileOpen(path: string, line?: number) {
      channelRef.current?.send({ type: 'file:open', path, line })
      onOpenFile?.(path, line)
    },
    sendFileWrite(path: string, content: string) {
      channelRef.current?.send({ type: 'file:write', path, content })
    },
    sendFilePreview(path: string) {
      channelRef.current?.send({ type: 'file:preview', path })
    },
    sendNodeSelect(nodeId: string, path?: string) {
      channelRef.current?.send({ type: 'node:select', nodeId, path })
    },
  }
}

function buildContextSnapshot(state: ReturnType<typeof useGraphStore.getState>): ContextSnapshot {
  const tasks: ContextSnapshot['tasks'] = []
  const documentStructure: ContextSnapshot['documentStructure'] = []
  const links: ContextSnapshot['links'] = []

  for (const [id, doc] of state.docContents) {
    // Collect tasks
    if (doc.tasks) {
      for (const task of doc.tasks) {
        tasks.push({
          title: task.title,
          status: task.status,
          source: `${id}:${task.sourceLine}`,
        })
      }
    }

    // Collect document structure
    if (doc.sections) {
      for (const section of doc.sections) {
        documentStructure.push({
          title: section.title,
          level: section.level,
          children: section.children?.map((c: { title: string; level: number }) => ({
            title: c.title,
            level: c.level,
          })),
        })
      }
    }
  }

  return {
    focusedFile: state.focusedNode ?? undefined,
    openPanels: Array.from(state.expandedPanels),
    tasks,
    documentStructure,
    links,
  }
}
