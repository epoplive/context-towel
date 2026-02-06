// Context Graph - Standalone graph application
// Embeddable as a webview or rendered in-process

export { createPostMessageChannel, createDirectChannel } from './channel'
export type {
  ChannelAdapter,
  InboundMessage,
  OutboundMessage,
  TreeItem,
  ContentUpdate,
  ProjectSettings,
  GraphRoot,
  ContextSnapshot,
} from './channel'

export { useChannelBridge } from './hooks/useChannelBridge'
export type { UseChannelBridgeOptions } from './hooks/useChannelBridge'

export { DocumentGraph } from './components/DocumentGraph'
export type { DocumentGraphProps } from './components/DocumentGraph'

export { useGraphStore } from './state/store'
