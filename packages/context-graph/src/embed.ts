// Embed entry point - for hosts that import the graph as a component
// Usage: import { ContextGraph } from '@context-towel/context-graph/embed'

export { createPostMessageChannel, createDirectChannel } from './channel'
export type {
  ChannelAdapter,
  InboundMessage,
  OutboundMessage,
  ContextSnapshot,
} from './channel'

// TODO: export ContextGraph React component once built
