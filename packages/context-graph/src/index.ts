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
