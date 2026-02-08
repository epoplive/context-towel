// Embed entry point - for hosts that import the graph as a component
// Usage: import { ContextGraph } from '@context-towel/context-graph/embed'

export { createPostMessageChannel, createDirectChannel } from './channel'
export type {
  ChannelAdapter,
  InboundMessage,
  OutboundMessage,
  ContextSnapshot,
} from './channel'

export { useChannelBridge } from './hooks/useChannelBridge'
export type { UseChannelBridgeOptions } from './hooks/useChannelBridge'

// Keep a stable "ContextGraph" name for hosts, even if the internal component
// remains `DocumentGraph` (historical LG naming).
export { DocumentGraph as ContextGraph } from './components/DocumentGraph'
export type { DocumentGraphProps as ContextGraphProps } from './components/DocumentGraph'
