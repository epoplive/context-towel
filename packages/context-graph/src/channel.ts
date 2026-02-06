// Channel API - Communication between graph app and host
// The graph never touches the filesystem directly.
// Host pushes data in, graph emits events out.

// --- Inbound (host → graph) ---

export interface TreeItem {
  id: string
  name: string
  path: string
  is_dir: boolean
  children?: TreeItem[]
}

export interface ContentUpdate {
  path: string
  content: string
}

export interface ProjectSettings {
  workingFolder?: string
  docsFolder?: string
  archiveFolder?: string
}

export interface GraphRoot {
  id: string
  path: string
  baseName: string
}

export type InboundMessage =
  | { type: 'tree:update'; items: TreeItem[] }
  | { type: 'content:update'; updates: ContentUpdate[] }
  | { type: 'focus:set'; path: string; line?: number }
  | { type: 'settings:update'; settings: ProjectSettings; themeTokens?: Record<string, string> }
  | { type: 'roots:set'; roots: GraphRoot[] }

// --- Outbound (graph → host) ---

export interface ContextSnapshot {
  focusedFile?: string
  openPanels: string[]
  tasks: Array<{ title: string; status: string; source: string }>
  documentStructure: Array<{ title: string; level: number; children?: Array<{ title: string; level: number }> }>
  links: Array<{ label: string; target: string; source: string }>
}

export type OutboundMessage =
  | { type: 'file:open'; path: string; line?: number }
  | { type: 'file:write'; path: string; content: string }
  | { type: 'file:preview'; path: string }
  | { type: 'node:select'; nodeId: string; path?: string }
  | { type: 'context:update'; snapshot: ContextSnapshot }

// --- Channel interface ---

export interface ChannelAdapter {
  /** Send a message to the host */
  send(message: OutboundMessage): void

  /** Subscribe to messages from the host */
  onMessage(handler: (message: InboundMessage) => void): () => void
}

/**
 * PostMessage-based channel adapter for webview embedding.
 * The host and graph communicate via window.postMessage.
 */
export function createPostMessageChannel(targetOrigin = '*'): ChannelAdapter {
  const handlers = new Set<(message: InboundMessage) => void>()

  const listener = (event: MessageEvent) => {
    // Validate message shape
    if (event.data && typeof event.data.type === 'string') {
      handlers.forEach(handler => handler(event.data as InboundMessage))
    }
  }
  window.addEventListener('message', listener)

  return {
    send(message: OutboundMessage) {
      // Post to parent if embedded, or to self for dev
      const target = window.parent !== window ? window.parent : window
      target.postMessage(message, targetOrigin)
    },

    onMessage(handler: (message: InboundMessage) => void) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
        if (handlers.size === 0) {
          window.removeEventListener('message', listener)
        }
      }
    },
  }
}

/**
 * Direct channel adapter for in-process usage (same React tree).
 * Useful for development and testing.
 */
export function createDirectChannel(): {
  hostSide: { send: (msg: InboundMessage) => void; onMessage: (handler: (msg: OutboundMessage) => void) => () => void }
  graphSide: ChannelAdapter
} {
  const inboundHandlers = new Set<(msg: InboundMessage) => void>()
  const outboundHandlers = new Set<(msg: OutboundMessage) => void>()

  return {
    hostSide: {
      send(msg: InboundMessage) {
        inboundHandlers.forEach(h => h(msg))
      },
      onMessage(handler: (msg: OutboundMessage) => void) {
        outboundHandlers.add(handler)
        return () => { outboundHandlers.delete(handler) }
      },
    },
    graphSide: {
      send(msg: OutboundMessage) {
        outboundHandlers.forEach(h => h(msg))
      },
      onMessage(handler: (msg: InboundMessage) => void) {
        inboundHandlers.add(handler)
        return () => { inboundHandlers.delete(handler) }
      },
    },
  }
}
